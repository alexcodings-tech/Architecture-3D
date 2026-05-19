import React from 'react'
import HeroSection from './components/HeroSection'
import VideoScrollSection from './components/VideoScrollSection'
import OutroSection from './components/OutroSection'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <main className="main-content">
        <HeroSection />
        <VideoScrollSection />
        <OutroSection />
      </main>
    </div>
  )
}
