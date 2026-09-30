import React from 'react';
import Navbar from '@/components/Navbar';
import MobileBottomTab from '@/components/MobileBottomTab';
import Footer from '@/components/Footer';
import { useSettings } from '@/lib/useSettings';
import { cn } from '@/lib/utils';

export default function Storefront({ children, className = '' }) {
  const { getSetting } = useSettings();
  const bgColor = getSetting('background_color', '#FFFCF8');

  return (
    <div className={cn('min-h-screen pb-20 md:pb-0', className)} style={{ backgroundColor: bgColor }}>
      <Navbar />
      {children}
      <Footer />
      <MobileBottomTab />
    </div>
  );
}
