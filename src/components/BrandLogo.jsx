import React from 'react';
import { cn } from '@/lib/utils';

export default function BrandLogo({ className = '' }) {
  return (
    <span
      className={cn(
        'inline-flex h-10 w-[148px] shrink-0 items-center overflow-visible md:h-12 md:w-[176px]',
        className,
      )}
    >
      <img
        src="/logo_winwin.png"
        alt="WinWin"
        width={280}
        height={80}
        decoding="async"
        className="block h-full w-full max-w-none object-contain object-left"
      />
    </span>
  );
}
