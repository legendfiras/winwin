import React from 'react';
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import {
  canRedeemProduct,
  formatPoints,
  pointsShortfall,
  productPointsCost,
} from '@/lib/pointsTiers';
import { cn } from '@/lib/utils';

export default function ProductPointsInfo({ product, customer, compact = false, className = '' }) {
  const cost = productPointsCost(product);
  if (!cost) return null;

  const loggedIn = Boolean(customer);
  const canRedeem = canRedeemProduct(product, customer);
  const shortfall = pointsShortfall(product, customer);
  const balance = Number(customer?.points) || 0;

  if (compact) {
    return (
      <p className={cn('mt-1 text-xs leading-snug', className)}>
        <span className="font-medium tabular-nums text-foreground">{formatPoints(cost)}</span>
        {loggedIn ? (
          canRedeem ? (
            <span className="font-medium text-primary"> · You can redeem</span>
          ) : (
            <span className="text-muted-foreground"> · Need {formatPoints(shortfall)} more</span>
          )
        ) : (
          <span className="text-muted-foreground"> · or redeem with points</span>
        )}
      </p>
    );
  }

  return (
    <div className={cn('rounded-[14px] border border-[rgba(201,176,130,0.35)] bg-[#FBF8F2] p-4', className)}>
      <p className="text-caption flex items-center gap-1.5 uppercase tracking-wide">
        <Gift className="h-3.5 w-3.5 text-primary" />
        Points
      </p>
      <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-foreground">
        {formatPoints(cost)} to redeem
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">$1 = 100 points</p>
      {loggedIn ? (
        canRedeem ? (
          <p className="mt-2 text-sm font-medium text-primary">
            You have {formatPoints(balance)} — you can redeem this item.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You have {formatPoints(balance)}. You need {formatPoints(shortfall)} more to redeem.
          </p>
        )
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link>
          {' '}to see if you can redeem this with your points.
        </p>
      )}
    </div>
  );
}
