import React, { useEffect, useRef, useState } from 'react'
import mobileVideoSrc from '../assets/phone_arch.mp4'
import './MobileVideoSection.css'

// ─── Frame extractor ────────────────────────────────────────────────────────
// Runs after mount in the background. Seeks through the video once,
// captures every frame as an ImageBitmap (GPU-resident, zero-copy draw).
// Target 20fps extraction — enough for smooth scrub, low memory.
const TARGET_FPS = 20

function extractFrames(src, onProgress) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.src = src
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const offscreen = document.createElement('canvas')
    const ctx = offscreen.getContext('2d')

    video.addEventListener('loadedmetadata', async () => {
      const duration = video.duration
      // Cap at 20fps — more than enough for cinematic scrub
      const total = Math.min(Math.floor(duration * TARGET_FPS), 600)
      offscreen.width  = video.videoWidth
      offscreen.height = video.videoHeight

      const frames = new Array(total + 1)

      for (let i = 0; i <= total; i++) {
        video.currentTime = (i / total) * duration

        // Wait for the frame to actually decode
        await new Promise(res => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            res()
          }
          video.addEventListener('seeked', onSeeked)
        })

        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height)

        try {
          frames[i] = await createImageBitmap(offscreen)
        } catch {
          // Fallback: clone the canvas as a blob URL
          frames[i] = null
        }

        if (onProgress) onProgress(Math.round((i / total) * 100))
      }

      resolve({ frames, total, width: offscreen.width, height: offscreen.height })
    })

    video.addEventListener('error', reject)
    video.load()
  })
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function MobileVideoSection() {
  const sectionRef = useRef(null)
  const canvasRef  = useRef(null)
  const [extractProgress, setExtractProgress] = useState(0)  // 0-100
  const [framesReady, setFramesReady]         = useState(false)

  // All render state — no re-renders
  const s = useRef({
    frames:       null,
    total:        0,
    width:        0,
    height:       0,
    currentIdx:   0,
    targetIdx:    0,
    rafId:        null,
    animating:    false,
  })

  // ─── Draw a specific frame index ────────────────────────────────────────
  function drawFrame(idx) {
    const { frames, total } = s.current
    if (!frames || !canvasRef.current) return
    const i = Math.max(0, Math.min(total, Math.round(idx)))
    const frame = frames[i]
    if (!frame) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
  }

  // ─── Resize canvas ──────────────────────────────────────────────────────
  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width: vw, height: vh } = s.current
    if (!vw || !vh) return

    const aspect = vw / vh
    const winW   = window.innerWidth
    const winH   = window.innerHeight

    // Render at 0.6× logical pixels — sharp enough, much cheaper
    const scale = 0.6
    if (winW / winH > aspect) {
      canvas.width  = Math.round(winW * scale)
      canvas.height = Math.round((winW / aspect) * scale)
    } else {
      canvas.height = Math.round(winH * scale)
      canvas.width  = Math.round((winH * aspect) * scale)
    }

    drawFrame(s.current.currentIdx)
  }

  // ─── Smooth RAF loop — integer frame index lerp ─────────────────────────
  // No seeking involved — just array index lookup + canvas draw.
  // This is why it can't lag: it's just memory reads + canvas blits.
  function loop() {
    s.current.rafId = requestAnimationFrame(loop)
    const state = s.current
    if (!state.frames) return

    const diff = state.targetIdx - state.currentIdx
    if (Math.abs(diff) < 0.5) {
      state.currentIdx = state.targetIdx
      return
    }

    // Lerp — 0.15 gives cinematic weight without feeling sluggish
    state.currentIdx += diff * 0.15
    drawFrame(state.currentIdx)
  }

  // ─── Scroll → frame index ───────────────────────────────────────────────
  function onScroll() {
    const state   = s.current
    const section = sectionRef.current
    if (!state.frames || !section) return

    const sectionTop       = section.offsetTop
    const scrollableHeight = section.offsetHeight - window.innerHeight
    const raw      = (window.scrollY - sectionTop) / scrollableHeight
    const progress = Math.max(0, Math.min(1, raw))

    state.targetIdx = progress * state.total
  }

  // ─── Mount: start background extraction, then kick off RAF ──────────────
  useEffect(() => {
    // Start extraction immediately in background
    extractFrames(mobileVideoSrc, (p) => {
      setExtractProgress(p)
    })
      .then(({ frames, total, width, height }) => {
        s.current.frames = frames
        s.current.total  = total
        s.current.width  = width
        s.current.height = height

        setFramesReady(true)

        // Size canvas now that we know video dimensions
        resizeCanvas()
        drawFrame(0)
      })
      .catch(err => console.error('Mobile frame extraction failed:', err))

    window.addEventListener('scroll', onScroll,     { passive: true })
    window.addEventListener('resize', resizeCanvas, { passive: true })

    // RAF loop runs always — draws nothing until frames arrive
    s.current.rafId = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(s.current.rafId)
    }
  }, [])

  return (
    <section className="video-scroll-section" ref={sectionRef}>
      <div className="video-sticky-container">

        {/* Canvas — shown once frames are ready */}
        <canvas
          ref={canvasRef}
          className={`video-canvas mobile-canvas ${framesReady ? 'mobile-canvas--ready' : ''}`}
          aria-hidden="true"
        />

        {/* Preparing overlay — fades out once frames are ready */}
        {!framesReady && (
          <div className="mobile-preparing">
            <div className="mobile-prep-bar-track">
              <div
                className="mobile-prep-bar-fill"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
            <span className="mobile-prep-label">
              {extractProgress < 100 ? 'Preparing experience…' : 'Almost ready…'}
            </span>
          </div>
        )}

        <div className="canvas-vignette" />
      </div>
    </section>
  )
}
