import React from 'react';
import HeroDecorations from '@/components/home/HeroDecorations';

function displayCardId(cardNumber) {
  const raw = String(cardNumber || '').trim();
  if (!raw) return 'WINXXXXXXXXX40';
  return /^win/i.test(raw) ? raw.toUpperCase() : `WIN${raw}`;
}

export default function HeroCardVisual({ cardNumber }) {
  return (
    <div className="hero-visual">
      <HeroDecorations />
      <div className="hero-stage">
        <div className="hero-card-float">
          <article className="hero-member-card">
            <span className="hero-card-pattern" aria-hidden="true" />
            <span className="hero-card-flourish" aria-hidden="true" />
            <img
              className="hero-card-logo"
              src="/logo_winwin.png"
              alt="WinWin"
              width={1942}
              height={809}
              fetchPriority="high"
              decoding="async"
            />
            <svg className="hero-card-bow" viewBox="0 0 64 56" aria-hidden="true">
              <path d="M32 18c8-14 26-14 26 2 0 10-12 14-26 20C18 34 6 30 6 20c0-16 18-16 26-2Z" fill="#C7952E" />
              <path d="M26 28h12l4 24H22l4-24Z" fill="#D9B76C" />
              <circle cx="32" cy="26" r="6" fill="#F3DE9A" />
            </svg>
            <span className="hero-card-id">{displayCardId(cardNumber)}</span>
          </article>
        </div>
        <div className="hero-podium" aria-hidden="true">
          <div className="hero-podium-body" />
          <div className="hero-podium-top" />
        </div>
      </div>
      <p className="hero-script" aria-hidden="true">
        Rewards
        <br />
        That Value
        <br />
        You
      </p>
    </div>
  );
}
