import React from 'react';
import { productImageSrc } from '@/lib/productImage';
import HeroDecorations from '@/components/home/HeroDecorations';

const FALLBACK_CARD = '/winwin-membership-card.png';

function resolveCardSrc(cardImage) {
  const raw = String(cardImage || '').trim();
  if (!raw || raw === FALLBACK_CARD) return FALLBACK_CARD;
  if (raw.startsWith('/winwin-membership-card')) return raw;
  return productImageSrc(raw) || FALLBACK_CARD;
}

export default function HeroCardVisual({ cardImage }) {
  const src = resolveCardSrc(cardImage);

  return (
    <div className="hero-visual">
      <div className="hero-glow" aria-hidden="true" />
      <HeroDecorations />
      <div className="hero-stage">
        <div className="hero-card-float">
          <img
            className="hero-card"
            src={src}
            alt="WinWin membership rewards card"
            width={1356}
            height={818}
            fetchPriority="high"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.src.includes(FALLBACK_CARD)) return;
              event.currentTarget.src = FALLBACK_CARD;
            }}
          />
        </div>
        <div className="hero-podium" aria-hidden="true">
          <div className="hero-podium-body" />
          <div className="hero-podium-top" />
        </div>
      </div>
    </div>
  );
}
