import React from 'react';
import { formatMoney, memberPrice, memberSavings } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export default function PriceDisplay({ price, hasCard, compact = false, className = '' }) {
  const regular = Number(price) || 0;
  const winwin = memberPrice(regular);
  const saved = memberSavings(regular);

  if (compact) {
    return (
      <div className={cn('min-h-[2.75rem]', className)}>
        {hasCard ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-caption line-through">{formatMoney(regular)}</span>
              <span className="font-heading text-base font-bold text-foreground">{formatMoney(winwin)}</span>
            </div>
            <p className="text-xs font-medium text-primary">WinWin member</p>
          </>
        ) : (
          <>
            <p className="font-heading text-base font-bold text-foreground">{formatMoney(regular)}</p>
            <p className="text-xs text-primary">WinWin {formatMoney(winwin)}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {hasCard ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg text-muted-foreground line-through">{formatMoney(regular)}</span>
          <span className="font-heading text-3xl font-bold text-foreground">{formatMoney(winwin)}</span>
        </div>
      ) : (
        <p className="font-heading text-3xl font-bold text-foreground">{formatMoney(regular)}</p>
      )}
      <p className={hasCard ? 'text-sm font-medium text-primary' : 'text-sm text-muted-foreground'}>
        {hasCard
          ? `Save ${formatMoney(saved)} with WinWin`
          : `WinWin members pay ${formatMoney(winwin)} · save ${formatMoney(saved)}`}
      </p>
    </div>
  );
}
