import React from 'react'
import HeroSection from './components/HeroSection'
import VideoScrollSection from './components/VideoScrollSection'
import MobileVideoSection from './components/MobileVideoSection'
import OutroSection from './components/OutroSection'
import './App.css'

// Detect mobile once at module load — avoids repeated checks in render.
// Matches phones and tablets (touch + narrow screen or explicit UA hint).
const isMobile = (() => {
  if (typeof window === 'undefined') return false
  const touch  = navigator.maxTouchPoints > 0
  const narrow = window.innerWidth <= 768
  return touch && narrow
})()

export default function App() {
  return (
    <div className="app">
      <main className="main-content">
        <HeroSection />
        {isMobile ? <MobileVideoSection /> : <VideoScrollSection />}
        <OutroSection />
      </main>
    </div>
  )
}
