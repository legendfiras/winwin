import React from 'react';
import { Link } from 'react-router-dom';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { useSettings } from '@/lib/useSettings';
import HeroCardVisual from '@/components/home/HeroCardVisual';
import HeroBenefits from '@/components/home/HeroBenefits';
import '@/components/home/winwin-hero.css';

export default function WinWinHero({ customer: customerProp }) {
  const customer = customerProp === undefined ? getCustomer() : customerProp;
  const { getSetting } = useSettings();
  const cardImage = getSetting('winwin_card_image', '/winwin-membership-card.png');
  const member = isCardActive(customer);
  const cta = member
    ? { href: '/winwin-card', label: 'View membership' }
    : customer
      ? { href: '/winwin-card', label: 'Join WinWin' }
      : { href: '/auth', label: 'Join WinWin' };

  return (
    <section className="winwin-hero" aria-label="WinWin membership">
      <div className="hero-content">
        <div className="hero-copy">
          <p className="hero-eyebrow">More rewards / A brighter tomorrow</p>
          <h1 className="hero-headline">
            <span className="gold">Win</span>
            <span className="burgundy">More</span>
            <span className="gold">Every Day</span>
          </h1>
          <p className="hero-description">
            Your exclusive membership for better rewards, special offers and more.
          </p>
          <Link className="hero-cta" to={cta.href}>
            {cta.label}
            <span className="hero-cta-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
        <HeroCardVisual cardImage={cardImage} />
        <div className="hero-benefits">
          <HeroBenefits />
        </div>
      </div>
    </section>
  );
}
