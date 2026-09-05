import React from 'react';
import HeroDecorations from '@/components/home/HeroDecorations';

export default function HeroCardVisual() {
  return (
    <div className="hero-visual">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-blob" aria-hidden="true" />
      <HeroDecorations />
      <div className="hero-stage">
        <div className="hero-logo-float">
          <img
            className="hero-logo"
            src="/logo_winwin.png"
            alt="WinWin"
            width={1942}
            height={809}
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="hero-ground" aria-hidden="true" />
      </div>
      <span className="hero-fg-arc" aria-hidden="true" />
    </div>
  );
}
