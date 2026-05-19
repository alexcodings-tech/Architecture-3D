import React, { useEffect, useRef } from 'react'
import mobileVideoSrc from '../assets/phone_arch.mp4'
import './MobileVideoSection.css'

// ─── Strategy ────────────────────────────────────────────────────────────────
// 1. On mount: seek the hidden video to t=0, paint frame 0 to canvas instantly.
//    User sees the first frame immediately — no black screen, no autoplay.
// 2. Extract all frames silently in the background (15fps, 0.5× res).
// 3. Once done, enable scroll control. Canvas was already visible from step 1.
//    No transition needed — it was showing the whole time.
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_FPS  = 15
const RENDER_SCALE = 0.5
const LERP         = 0.13

export default function MobileVideoSection() {
  const sectionRef = useRef(null)
  const canvasRef  = useRef(null)

  const s = useRef({
    frames:      null,
    total:       0,
    vw:          0,
    vh:          0,
    currentIdx:  0,
    targetIdx:   0,
    rafId:       null,
    ready:       false,   // true once all frames extracted
  })

  // ─── Size canvas to cover viewport in portrait/landscape ─────────────────
  // Uses CSS object-fit:cover logic manually so the canvas always fills screen
  function sizeCanvas(vw, vh) {
    const canvas = canvasRef.current
    if (!canvas) return

    const videoAspect  = vw / vh
    const screenAspect = window.innerWidth / window.innerHeight

    // Internal pixel dimensions at RENDER_SCALE
    let drawW, drawH
    if (screenAspect > videoAspect) {
      // Screen is wider than video → fit width, crop height
      drawW = Math.round(window.innerWidth  * RENDER_SCALE)
      drawH = Math.round(window.innerWidth / videoAspect * RENDER_SCALE)
    } else {
      // Screen is taller than video (portrait phone) → fit height, crop width
      drawH = Math.round(window.innerHeight * RENDER_SCALE)
      drawW = Math.round(window.innerHeight * videoAspect * RENDER_SCALE)
    }

    canvas.width  = drawW
    canvas.height = drawH
  }

  // ─── Draw a frame index ───────────────────────────────────────────────────
  function drawFrame(idx) {
    const { frames, total } = s.current
    if (!frames || !canvasRef.current) return
    const i     = Math.max(0, Math.min(total, Math.round(idx)))
    const frame = frames[i]
    if (!frame) return
    canvasRef.current
      .getContext('2d', { alpha: false })
      .drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  // ─── RAF loop ─────────────────────────────────────────────────────────────
  function loop() {
    s.current.rafId = requestAnimationFrame(loop)
    const state = s.current
    if (!state.ready) return

    const diff = state.targetIdx - state.currentIdx
    if (Math.abs(diff) < 0.4) return

    state.currentIdx += diff * LERP
    drawFrame(state.currentIdx)
  }

  // ─── Scroll → target index ────────────────────────────────────────────────
  function onScroll() {
    const state   = s.current
    const section = sectionRef.current
    if (!state.ready || !section) return

    const top      = section.offsetTop
    const height   = section.offsetHeight - window.innerHeight
    const progress = Math.max(0, Math.min(1, (window.scrollY - top) / height))
    state.targetIdx = progress * state.total
  }

  // ─── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    s.current.rafId = requestAnimationFrame(loop)
    window.addEventListener('scroll', onScroll, { passive: true })

    // Hidden seeker video — never shown, never autoplays
    const seeker = document.createElement('video')
    seeker.src        = mobileVideoSrc
    seeker.muted      = true
    seeker.playsInline = true
    seeker.preload    = 'auto'

    const offscreen = document.createElement('canvas')
    const ctx       = offscreen.getContext('2d')

    async function run() {
      // Wait for metadata
      await new Promise(res => {
        if (seeker.readyState >= 1) return res()
        seeker.addEventListener('loadedmetadata', res, { once: true })
        seeker.load()
      })

      const duration = seeker.duration
      const total    = Math.min(Math.floor(duration * EXTRACT_FPS), 500)
      const vw       = seeker.videoWidth
      const vh       = seeker.videoHeight

      s.current.vw = vw
      s.current.vh = vh
      s.current.total = total

      offscreen.width  = Math.round(vw * RENDER_SCALE)
      offscreen.height = Math.round(vh * RENDER_SCALE)

      // Size canvas before drawing anything
      sizeCanvas(vw, vh)

      const frames = new Array(total + 1)

      // ── Seek to frame 0 first and paint it immediately ──
      // This gives the user something to see with zero delay
      seeker.currentTime = 0
      await new Promise(res => seeker.addEventListener('seeked', res, { once: true }))
      ctx.drawImage(seeker, 0, 0, offscreen.width, offscreen.height)
      frames[0] = await createImageBitmap(offscreen).catch(() => null)

      s.current.frames = frames  // partial — only frame 0 so far
      drawFrame(0)               // paint it to canvas NOW

      // ── Extract remaining frames in background ──
      for (let i = 1; i <= total; i++) {
        seeker.currentTime = (i / total) * duration
        await new Promise(res => seeker.addEventListener('seeked', res, { once: true }))
        ctx.drawImage(seeker, 0, 0, offscreen.width, offscreen.height)
        frames[i] = await createImageBitmap(offscreen).catch(() => null)
      }

      // All frames ready — enable scroll control
      s.current.frames = frames
      s.current.ready  = true
    }

    run().catch(err => console.error('Mobile extraction failed:', err))

    const handleResize = () => {
      sizeCanvas(s.current.vw || 1080, s.current.vh || 1920)
      drawFrame(s.current.currentIdx)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      cancelAnimationFrame(s.current.rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', handleResize)
      seeker.src = ''
    }
  }, [])

  return (
    <section className="video-scroll-section" ref={sectionRef}>
      <div className="video-sticky-container">
        {/* Canvas is always visible — shows frame 0 immediately, then scroll-controlled */}
        <canvas
          ref={canvasRef}
          className="mobile-canvas"
          aria-hidden="true"
        />
        <div className="canvas-vignette" />
      </div>
    </section>
  )
}
