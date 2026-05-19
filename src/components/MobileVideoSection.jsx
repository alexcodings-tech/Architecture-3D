import React, { useEffect, useRef } from 'react'
import mobileVideoSrc from '../assets/phone_arch.mp4'
import './MobileVideoSection.css'

// ─── Strategy ────────────────────────────────────────────────────────────────
//
// Phase 1 — INSTANT (0ms wait):
//   The <video> autoplays and loops visibly. User sees video immediately.
//   Frame extraction runs silently in the background.
//
// Phase 2 — SEAMLESS SWITCH (when extraction finishes):
//   Canvas fades in over the video at the exact current playback position.
//   Video element is paused + hidden. Scroll now controls the canvas.
//
// No loading bar. No black screen. No wait.
//
// Extraction uses only 15fps and 0.5× resolution to finish fast on mobile.
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_FPS  = 15    // frames per second to capture
const RENDER_SCALE = 0.5   // canvas pixel density (0.5 = half-res, 4× cheaper)
const LERP         = 0.13  // scroll smoothing factor

export default function MobileVideoSection() {
  const sectionRef  = useRef(null)
  const canvasRef   = useRef(null)
  const videoRef    = useRef(null)  // the visible autoplay video

  const s = useRef({
    frames:      null,   // ImageBitmap[]
    total:       0,
    currentIdx:  0,
    targetIdx:   0,
    rafId:       null,
    switched:    false,  // true once canvas has taken over
  })

  // ─── Draw frame index onto canvas ─────────────────────────────────────────
  function drawFrame(idx) {
    const { frames, total } = s.current
    if (!frames || !canvasRef.current) return
    const i = Math.max(0, Math.min(total, Math.round(idx)))
    const frame = frames[i]
    if (!frame) return
    canvasRef.current
      .getContext('2d', { alpha: false })
      .drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  // ─── Size canvas (low-res, CSS upscales) ──────────────────────────────────
  function sizeCanvas(vw, vh) {
    const canvas  = canvasRef.current
    if (!canvas) return
    const aspect  = vw / vh
    const winW    = window.innerWidth
    const winH    = window.innerHeight
    const s_      = RENDER_SCALE

    if (winW / winH > aspect) {
      canvas.width  = Math.round(winW * s_)
      canvas.height = Math.round((winW / aspect) * s_)
    } else {
      canvas.height = Math.round(winH * s_)
      canvas.width  = Math.round((winH * aspect) * s_)
    }
  }

  // ─── RAF loop — pure array lookup, zero video decoding ────────────────────
  function loop() {
    s.current.rafId = requestAnimationFrame(loop)
    const state = s.current
    if (!state.switched || !state.frames) return

    const diff = state.targetIdx - state.currentIdx
    if (Math.abs(diff) < 0.4) return

    state.currentIdx += diff * LERP
    drawFrame(state.currentIdx)
  }

  // ─── Scroll → target index ────────────────────────────────────────────────
  function onScroll() {
    const state   = s.current
    const section = sectionRef.current
    if (!state.switched || !section) return

    const top      = section.offsetTop
    const height   = section.offsetHeight - window.innerHeight
    const progress = Math.max(0, Math.min(1, (window.scrollY - top) / height))
    state.targetIdx = progress * state.total
  }

  // ─── Background frame extraction ──────────────────────────────────────────
  async function extractInBackground(video) {
    // Wait for metadata
    await new Promise(res => {
      if (video.readyState >= 1) return res()
      video.addEventListener('loadedmetadata', res, { once: true })
    })

    const duration = video.duration
    const total    = Math.min(Math.floor(duration * EXTRACT_FPS), 500)
    const vw       = video.videoWidth
    const vh       = video.videoHeight

    // Size the canvas now (hidden, opacity 0)
    sizeCanvas(vw, vh)

    const offscreen = document.createElement('canvas')
    offscreen.width  = Math.round(vw * RENDER_SCALE)
    offscreen.height = Math.round(vh * RENDER_SCALE)
    const ctx = offscreen.getContext('2d')

    // Use a separate hidden video for seeking so the visible one keeps playing
    const seeker = document.createElement('video')
    seeker.src        = mobileVideoSrc
    seeker.muted      = true
    seeker.playsInline = true
    seeker.preload    = 'auto'

    const frames = new Array(total + 1)

    for (let i = 0; i <= total; i++) {
      seeker.currentTime = (i / total) * duration

      await new Promise(res => {
        seeker.addEventListener('seeked', res, { once: true })
      })

      ctx.drawImage(seeker, 0, 0, offscreen.width, offscreen.height)

      try {
        frames[i] = await createImageBitmap(offscreen)
      } catch {
        frames[i] = null
      }
    }

    return { frames, total, vw, vh }
  }

  // ─── Seamless switch: canvas takes over from video ─────────────────────────
  function switchToCanvas(frames, total, vw, vh) {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Find which frame matches current video playback position
    const progress  = video.currentTime / video.duration
    const startIdx  = Math.round(progress * total)

    s.current.frames     = frames
    s.current.total      = total
    s.current.currentIdx = startIdx
    s.current.targetIdx  = startIdx

    // Draw that frame immediately so there's no visual jump
    drawFrame(startIdx)

    // Fade canvas in, fade video out simultaneously
    canvas.style.opacity = '1'
    video.style.opacity  = '0'

    // After transition, pause + hide video to free resources
    setTimeout(() => {
      video.pause()
      video.style.display = 'none'
      s.current.switched = true
    }, 400)
  }

  // ─── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Start RAF loop immediately
    s.current.rafId = requestAnimationFrame(loop)

    // Extract frames in background while video plays
    extractInBackground(video)
      .then(({ frames, total, vw, vh }) => {
        switchToCanvas(frames, total, vw, vh)
      })
      .catch(err => console.error('Frame extraction error:', err))

    window.addEventListener('scroll', onScroll,    { passive: true })
    window.addEventListener('resize', () => {
      const { width: vw, height: vh } = s.current
      sizeCanvas(vw || 1080, vh || 1920)
      drawFrame(s.current.currentIdx)
    }, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(s.current.rafId)
    }
  }, [])

  return (
    <section className="video-scroll-section" ref={sectionRef}>
      <div className="video-sticky-container">

        {/* Phase 1: visible autoplay video — plays immediately */}
        <video
          ref={videoRef}
          src={mobileVideoSrc}
          autoPlay
          muted
          loop
          playsInline
          className="mobile-bg-video"
          aria-hidden="true"
        />

        {/* Phase 2: canvas — invisible until extraction done, then fades in */}
        <canvas
          ref={canvasRef}
          className="video-canvas mobile-canvas"
          aria-hidden="true"
        />

        <div className="canvas-vignette" />
      </div>
    </section>
  )
}
