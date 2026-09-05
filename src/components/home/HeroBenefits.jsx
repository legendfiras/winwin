import React from 'react';
import { Gift, Coins, Crown } from 'lucide-react';

const BENEFITS = [
  { icon: Gift, label: 'Exclusive Offers' },
  { icon: Coins, label: 'Earn Points' },
  { icon: Crown, label: 'Premium Benefits' },
];

export default function HeroBenefits() {
  return (
    <ul className="hero-benefits-list">
      {BENEFITS.map((item) => (
        <li key={item.label} className="hero-benefit">
          <span className="hero-benefit-icon" aria-hidden="true">
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
