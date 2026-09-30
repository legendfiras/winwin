import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgePercent, Instagram, MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import Container from '@/components/Container';
import { useSettings } from '@/lib/useSettings';

const shopLinks = [
  { label: 'Shop all', to: '/' },
  { label: 'WinWin Card', to: '/winwin-card' },
  { label: 'My account', to: '/my-account' },
  { label: 'Your cart', to: '/cart' },
];

const policyLinks = [
  { label: 'Privacy policy', to: '/privacy-policy' },
  { label: 'Terms & conditions', to: '/terms-and-conditions' },
  { label: 'Shipping policy', to: '/shipping-policy' },
  { label: 'Returns & refunds', to: '/returns-and-refunds' },
];

function TikTokIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M15.58 3c.18 1.56 1.05 2.92 2.35 3.74A6.4 6.4 0 0 0 21 7.7v3.08a9.3 9.3 0 0 1-5.4-1.73v6.24a6.29 6.29 0 1 1-5.43-6.23v3.17a3.22 3.22 0 1 0 2.35 3.1V3h3.06Z" />
    </svg>
  );
}

export default function Footer() {
  const { getSetting } = useSettings();
  const rawNumber = getSetting('whatsapp_number', '0096178714472');
  const whatsappNumber = rawNumber.replace(/[^0-9]/g, '').replace(/^0+/, '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi! I need help with WinWin.')}`;
  const instagramUrl = getSetting('instagram_url', 'https://www.instagram.com/winwin.leb/');
  const tiktokUrl = getSetting('tiktok_url', 'https://www.tiktok.com/@winwin.leb');
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 overflow-hidden bg-[#4b0d1a] text-white md:mt-16">
      <div aria-hidden="true" className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#c7952e]/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#9f1d35]/50 blur-3xl" />

      <Container className="relative py-10 md:py-14">
        <div className="mb-10 grid overflow-hidden rounded-2xl border border-[#d9b76c]/25 bg-white/[0.06] sm:grid-cols-2 md:mb-12">
          <div className="flex items-center gap-4 px-5 py-5 sm:px-7 md:py-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d9b76c]/15 text-[#f0d99f]">
              <BadgePercent className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-white">15% member discount</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Save on every eligible order with your WinWin Card.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-[#d9b76c]/20 px-5 py-5 sm:border-l sm:border-t-0 sm:px-7 md:py-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d9b76c]/15 text-[#f0d99f]">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-white">Free delivery</p>
              <p className="mt-1 text-xs leading-5 text-white/60">WinWin Card members enjoy delivery on us.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-10 border-b border-white/15 pb-10 md:grid-cols-[1.35fr_0.7fr_0.9fr] md:gap-12 md:pb-12">
          <div className="max-w-md">
            <Link to="/" className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5c77f]" aria-label="WinWin home">
              <BrandLogo className="h-14 w-[190px] md:h-16 md:w-[220px]" />
            </Link>
            <p className="mt-5 text-sm leading-7 text-white/70">
              Everyday finds, member-only savings, and rewards that make every purchase feel like a win.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d9b76c]/40 bg-[#d9b76c]/10 px-4 py-2.5 text-sm font-semibold text-[#f6dfaa] transition hover:border-[#d9b76c]/70 hover:bg-[#d9b76c]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5c77f]"
            >
              <MessageCircle className="h-4 w-4" />
              Chat with us
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <div className="mt-5 flex items-center gap-2" aria-label="WinWin social media">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow WinWin on Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition hover:-translate-y-0.5 hover:border-[#d9b76c]/60 hover:bg-[#d9b76c]/15 hover:text-[#f6dfaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5c77f]"
              >
                <Instagram className="h-[18px] w-[18px]" />
              </a>
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow WinWin on TikTok"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition hover:-translate-y-0.5 hover:border-[#d9b76c]/60 hover:bg-[#d9b76c]/15 hover:text-[#f6dfaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5c77f]"
              >
                <TikTokIcon className="h-[18px] w-[18px]" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with WinWin on WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition hover:-translate-y-0.5 hover:border-[#d9b76c]/60 hover:bg-[#d9b76c]/15 hover:text-[#f6dfaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5c77f]"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          <nav aria-label="Footer shop links">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-[#e5c77f]">Explore</h2>
            <ul className="mt-5 space-y-3.5">
              {shopLinks.map((link) => (
                <li key={link.to}>
                  <Link className="text-sm text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:text-white" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer policy links">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-[#e5c77f]">Customer care</h2>
            <ul className="mt-5 space-y-3.5">
              {policyLinks.map((link) => (
                <li key={link.to}>
                  <Link className="text-sm text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:text-white" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-5 pt-7 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© {year} WinWin. All rights reserved.</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#d9b76c]" />
              Secure shopping
            </span>
          </div>
          <a
            href="https://roytech.solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-fit items-center gap-1.5 text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#d9b76c]" />
            Designed by <span className="font-semibold text-[#f0d99f]">Roytech</span>
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </Container>
    </footer>
  );
}
