import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Truck, Percent, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WinWinCardBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-orange-400 p-6 md:p-8 text-white">
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-6 h-6 fill-white" />
          <h3 className="font-heading font-bold text-2xl">WinWin Card</h3>
        </div>
        <p className="text-white/90 mb-4 font-body">
          Only <span className="font-bold text-xl">$10/month</span> — Get amazing benefits!
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Truck className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Free Delivery</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Percent className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">15% Discount</span>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Gift className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Draw Entries</span>
          </div>
        </div>
        <Link to="/winwin-card">
          <Button variant="secondary" className="font-heading font-semibold">
            Learn More
          </Button>
        </Link>
      </div>
    </div>
  );
}