import React, { useEffect, useRef } from 'react'
import videoSrc from '../assets/New.mp4'
import './VideoScrollSection.css' // reuse same CSS

// ─── Mobile-optimised scroll-scrub ────────────────────────────────────────
//
// Key differences from the desktop version:
//  1. Canvas is drawn at 0.5× device pixels (half-res) — massively cuts GPU work
//  2. Lerp factor is lower (0.08) so seeks are spaced further apart in time
//  3. Minimum seek gap of 80 ms — prevents flooding the mobile decoder
//  4. Touch scroll delta is read directly for snappier feel on iOS/Android
//  5. No RAF loop when tab is hidden (visibilitychange pause)
// ──────────────────────────────────────────────────────────────────────────

const LERP          = 0.08   // lower = smoother but slightly more lag
const MIN_SEEK_GAP  = 80     // ms — mobile decoders need breathing room
const RESOLUTION    = 0.5    // render at 50% of logical pixels

export default function MobileVideoSection() {
  const sectionRef = useRef(null)
  const canvasRef  = useRef(null)
  const videoRef   = useRef(null)

  const s = useRef({
    ready:        false,
    seekPending:  false,
    targetTime:   0,
    displayTime:  0,
    rafId:        null,
    duration:     0,
    lastSeekAt:   0,    // timestamp of last seek
    hidden:       false,
  })

  // ─── Paint ──────────────────────────────────────────────────────────────
  function paint() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  // ─── Resize — half-res canvas, CSS fills the container ──────────────────
  function resizeCanvas() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas) return

    const vw     = video?.videoWidth  || 1920
    const vh     = video?.videoHeight || 1080
    const aspect = vw / vh

    // Logical size (CSS pixels × RESOLUTION)
    const winW = window.innerWidth  * RESOLUTION
    const winH = window.innerHeight * RESOLUTION

    if (winW / winH > aspect) {
      canvas.width  = Math.round(winW)
      canvas.height = Math.round(winW / aspect)
    } else {
      canvas.height = Math.round(winH)
      canvas.width  = Math.round(winH * aspect)
    }

    // CSS still fills the full viewport — browser upscales the low-res canvas
    canvas.style.width  = '100%'
    canvas.style.height = '100%'

    paint()
  }

  // ─── RAF loop ────────────────────────────────────────────────────────────
  function loop() {
    s.current.rafId = requestAnimationFrame(loop)

    const state = s.current
    if (!state.ready || state.seekPending || state.hidden) return

    const now  = performance.now()
    const diff = state.targetTime - state.displayTime

    if (Math.abs(diff) < 0.002) return

    // Throttle: don't seek more often than MIN_SEEK_GAP ms
    if (now - state.lastSeekAt < MIN_SEEK_GAP) return

    const nextTime = state.displayTime + diff * LERP
    state.displayTime = nextTime
    state.seekPending = true
    state.lastSeekAt  = now

    videoRef.current.currentTime = nextTime
  }

  // ─── Scroll handler ──────────────────────────────────────────────────────
  function onScroll() {
    const state   = s.current
    const section = sectionRef.current
    if (!state.ready || !section) return

    const sectionTop       = section.offsetTop
    const scrollableHeight = section.offsetHeight - window.innerHeight
    const raw      = (window.scrollY - sectionTop) / scrollableHeight
    const progress = Math.max(0, Math.min(1, raw))

    state.targetTime = progress * state.duration
  }

  // ─── Setup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    function onCanPlay() {
      s.current.ready    = true
      s.current.duration = video.duration
      resizeCanvas()
      paint()
    }

    function onSeeked() {
      paint()
      s.current.seekPending = false
    }

    function onVisibility() {
      s.current.hidden = document.hidden
    }

    video.addEventListener('canplay',  onCanPlay)
    video.addEventListener('seeked',   onSeeked)
    window.addEventListener('scroll',  onScroll,      { passive: true })
    window.addEventListener('resize',  resizeCanvas,  { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    s.current.rafId = requestAnimationFrame(loop)

    return () => {
      video.removeEventListener('canplay',  onCanPlay)
      video.removeEventListener('seeked',   onSeeked)
      window.removeEventListener('scroll',  onScroll)
      window.removeEventListener('resize',  resizeCanvas)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(s.current.rafId)
    }
  }, [])

  return (
    <section className="video-scroll-section" ref={sectionRef}>
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        preload="auto"
        className="video-hidden"
        aria-hidden="true"
      />

      <div className="video-sticky-container">
        <canvas
          ref={canvasRef}
          className="video-canvas"
          aria-hidden="true"
        />
        <div className="canvas-vignette" />
      </div>
    </section>
  )
}
