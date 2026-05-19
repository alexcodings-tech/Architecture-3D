import React, { useEffect, useRef } from 'react'
import videoSrc from '../assets/New.mp4'
import './VideoScrollSection.css'

export default function VideoScrollSection() {
  const sectionRef  = useRef(null)
  const canvasRef   = useRef(null)
  const videoRef    = useRef(null)

  // All mutable state lives here — never triggers re-renders
  const s = useRef({
    ready:        false,   // video has enough data
    seekPending:  false,   // a seek is in-flight
    targetTime:   0,       // where we want to be
    displayTime:  0,       // where canvas currently shows
    rafId:        null,
    duration:     0,
  })

  // ─── Draw current video frame to canvas ───────────────────────────────────
  function paint() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  // ─── Resize canvas to cover viewport ──────────────────────────────────────
  function resizeCanvas() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas) return

    const vw = video?.videoWidth  || 1920
    const vh = video?.videoHeight || 1080
    const aspect = vw / vh

    const winW = window.innerWidth
    const winH = window.innerHeight

    if (winW / winH > aspect) {
      canvas.width  = winW
      canvas.height = Math.round(winW / aspect)
    } else {
      canvas.height = winH
      canvas.width  = Math.round(winH * aspect)
    }

    paint()
  }

  // ─── Main render loop ──────────────────────────────────────────────────────
  // Runs on every RAF tick while the page is open.
  // Only seeks when needed; never queues more than one seek at a time.
  function loop() {
    const state = s.current
    s.current.rafId = requestAnimationFrame(loop)

    if (!state.ready || state.seekPending) return

    const diff = state.targetTime - state.displayTime

    // Dead-zone: don't seek for sub-millisecond differences
    if (Math.abs(diff) < 0.001) return

    // Lerp: move 14% of the remaining gap each frame → cinematic weight
    const nextTime = state.displayTime + diff * 0.14
    state.displayTime = nextTime

    state.seekPending = true
    videoRef.current.currentTime = nextTime
  }

  // ─── Scroll → target time ─────────────────────────────────────────────────
  function onScroll() {
    const state   = s.current
    const section = sectionRef.current
    if (!state.ready || !section) return

    const sectionTop      = section.offsetTop
    const scrollableHeight = section.offsetHeight - window.innerHeight
    const raw = (window.scrollY - sectionTop) / scrollableHeight
    const progress = Math.max(0, Math.min(1, raw))

    state.targetTime = progress * state.duration
  }

  // ─── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // When enough data is available, mark ready and paint frame 0
    function onCanPlay() {
      s.current.ready    = true
      s.current.duration = video.duration
      resizeCanvas()
      paint()
    }

    // After each seek completes, paint the new frame
    function onSeeked() {
      paint()
      s.current.seekPending = false
    }

    video.addEventListener('canplay',  onCanPlay)
    video.addEventListener('seeked',   onSeeked)
    window.addEventListener('scroll',  onScroll, { passive: true })
    window.addEventListener('resize',  resizeCanvas, { passive: true })

    // Kick off the RAF loop
    s.current.rafId = requestAnimationFrame(loop)

    return () => {
      video.removeEventListener('canplay',  onCanPlay)
      video.removeEventListener('seeked',   onSeeked)
      window.removeEventListener('scroll',  onScroll)
      window.removeEventListener('resize',  resizeCanvas)
      cancelAnimationFrame(s.current.rafId)
    }
  }, [])

  return (
    <section className="video-scroll-section" ref={sectionRef}>
      {/* Hidden video element — only used as a decode source */}
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
        {/* Depth vignette only — no colour tint */}
        <div className="canvas-vignette" />
      </div>
    </section>
  )
}
