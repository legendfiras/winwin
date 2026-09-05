import React from 'react';

export default function HeroDecorations() {
  return (
    <div className="hero-decorations" aria-hidden="true">
      <svg className="hero-ribbons" viewBox="0 0 900 820" fill="none">
        <path
          d="M70 430 C 180 250, 330 210, 470 300 C 610 390, 700 250, 860 190"
          stroke="url(#heroGoldRibbon)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M40 500 C 190 560, 310 430, 470 470 C 650 520, 760 610, 880 540"
          stroke="url(#heroBurgundyRibbon)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M120 360 C 260 140, 520 80, 780 220"
          stroke="url(#heroGoldRibbon)"
          strokeWidth="5"
          strokeOpacity="0.7"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="heroGoldRibbon" x1="70" y1="190" x2="860" y2="540" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F3DE9A" />
            <stop offset="0.45" stopColor="#C7952E" />
            <stop offset="1" stopColor="#8A6418" />
          </linearGradient>
          <linearGradient id="heroBurgundyRibbon" x1="40" y1="430" x2="880" y2="610" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8A2A2E" />
            <stop offset="0.5" stopColor="#641616" />
            <stop offset="1" stopColor="#3E090B" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
