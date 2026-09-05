import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, Percent, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCustomer } from '@/lib/customerAuth';
import { getMembershipUi } from '@/lib/membership';

export default function WinWinCardBanner({ customer: customerProp }) {
  const customer = customerProp === undefined ? getCustomer() : customerProp;
  const ui = getMembershipUi(customer);

  return (
    <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-r from-[#FF6500] to-[#FF8126] px-5 py-5 text-white md:px-8 md:py-6">
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative grid items-center gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">{ui.kicker}</p>
          <h2 className="mt-1 font-heading text-xl font-bold leading-tight md:text-2xl">{ui.title}</h2>
          <p className="mt-2 text-sm text-white/95">15% off · Free delivery · Exclusive prize draws</p>
          {ui.expiry ? <p className="mt-1 text-sm text-white/90">Expires {ui.expiry}</p> : null}
          {ui.status === 'guest' || ui.status === 'none' ? (
            <p className="mt-3 font-heading text-lg font-semibold">$10 / month</p>
          ) : null}
          {ui.cta ? (
            <Button asChild className="mt-4 h-11 rounded-[10px] bg-white text-[#E95B00] hover:bg-[#FFF3E9]">
              <Link to={ui.href}>{ui.cta} →</Link>
            </Button>
          ) : null}
        </div>
        <ul className="hidden gap-2 md:grid">
          <li className="flex items-center gap-2 rounded-[10px] bg-white/15 px-3 py-2 text-sm">
            <Percent className="h-4 w-4 shrink-0" /> 15% member discount
          </li>
          <li className="flex items-center gap-2 rounded-[10px] bg-white/15 px-3 py-2 text-sm">
            <Truck className="h-4 w-4 shrink-0" /> Free delivery
          </li>
          <li className="flex items-center gap-2 rounded-[10px] bg-white/15 px-3 py-2 text-sm">
            <Gift className="h-4 w-4 shrink-0" /> Prize-draw entries
          </li>
        </ul>
      </div>
    </section>
  );
}
