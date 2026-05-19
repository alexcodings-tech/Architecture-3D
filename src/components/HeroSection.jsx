import React, { useEffect, useRef } from 'react'
import './HeroSection.css'

export default function HeroSection() {
  const headlineRef = useRef(null)
  const subRef = useRef(null)
  const scrollHintRef = useRef(null)

  useEffect(() => {
    // Staggered entrance animation
    const elements = [headlineRef.current, subRef.current, scrollHintRef.current]
    elements.forEach((el, i) => {
      if (!el) return
      el.style.opacity = '0'
      el.style.transform = 'translateY(30px)'
      setTimeout(() => {
        el.style.transition = 'opacity 1.2s ease, transform 1.2s ease'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }, 300 + i * 200)
    })
  }, [])

  return (
    <section className="hero-section">
      {/* Subtle vignette overlay */}
      <div className="hero-vignette" />

      <div className="hero-content">
        <div className="hero-eyebrow">
          <span>A Cinematic Experience</span>
        </div>

        <h1 className="hero-headline" ref={headlineRef}>
          Scroll Through
          <br />
          <em>the Story</em>
        </h1>

        <p className="hero-subtext" ref={subRef}>
          Every movement reveals the next frame.
        </p>
      </div>

      <div className="hero-scroll-hint" ref={scrollHintRef}>
        <div className="scroll-line" />
        <span className="scroll-label">Scroll to begin</span>
      </div>
    </section>
  )
}
