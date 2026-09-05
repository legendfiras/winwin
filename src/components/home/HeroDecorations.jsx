import React from 'react';

export default function HeroDecorations() {
  return (
    <div className="hero-decorations" aria-hidden="true">
      <svg className="hero-rings" viewBox="0 0 1000 1000" fill="none">
        <g className="hero-ring-spin-slow">
          <ellipse
            cx="520"
            cy="470"
            rx="390"
            ry="268"
            transform="rotate(-22 520 470)"
            stroke="var(--winwin-gold)"
            strokeOpacity="0.42"
            strokeWidth="1.35"
          />
        </g>
        <ellipse
          className="hero-ring-fill"
          cx="470"
          cy="500"
          rx="248"
          ry="198"
          transform="rotate(14 470 500)"
          fill="var(--winwin-burgundy)"
          fillOpacity="0.11"
          stroke="var(--winwin-burgundy)"
          strokeOpacity="0.22"
          strokeWidth="1.2"
        />
        <g className="hero-ring-spin-reverse">
          <ellipse
            cx="540"
            cy="490"
            rx="228"
            ry="318"
            transform="rotate(28 540 490)"
            stroke="var(--winwin-gold-light)"
            strokeOpacity="0.34"
            strokeWidth="1"
          />
        </g>
        <path
          d="M140 430 C 210 210, 470 140, 720 250"
          stroke="var(--winwin-burgundy)"
          strokeOpacity="0.28"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          className="hero-ring-arc"
          d="M780 250 C 910 360, 900 620, 690 760"
          stroke="var(--winwin-gold)"
          strokeOpacity="0.38"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <ellipse
          cx="610"
          cy="430"
          rx="150"
          ry="108"
          transform="rotate(-38 610 430)"
          stroke="var(--winwin-burgundy)"
          strokeOpacity="0.16"
          strokeWidth="1.1"
        />
      </svg>
    </div>
  );
}
