import React, { useEffect, useRef } from 'react'
import './OutroSection.css'

export default function OutroSection() {
  const sectionRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          contentRef.current?.classList.add('outro-content--visible')
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="outro-section" ref={sectionRef}>
      <div className="outro-content" ref={contentRef}>
        <div className="outro-divider" />

        <p className="outro-eyebrow">The Experience</p>

        <h2 className="outro-headline">
          Every frame,
          <br />
          <em>intentional.</em>
        </h2>

        <p className="outro-body">
          Crafted for those who appreciate the space between moments.
        </p>

        <div className="outro-divider" />
      </div>
    </section>
  )
}
