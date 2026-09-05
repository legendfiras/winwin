import React from 'react';

export default function HeroCardVisual() {
  return (
    <div className="hero-visual">
      <img
        className="hero-art"
        src="/winwin-hero-card.png"
        alt="WinWin membership card"
        width={578}
        height={472}
        fetchPriority="high"
        decoding="async"
      />
    </div>
  );
}
