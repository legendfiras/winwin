import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function QuantitySelector({ value, onChange, min = 1, max = undefined, disabled = false, size = 'md' }) {
  const compact = size === 'sm';
  const btn = compact ? 'h-8 w-8 min-h-8 min-w-8' : 'h-11 w-11 min-h-[44px] min-w-[44px]';

  return (
    <div className={cn('inline-flex items-center rounded-[10px] border border-border bg-white')}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={btn}
        onClick={() => onChange(Math.max(min, Number(value) - 1))}
        disabled={disabled || Number(value) <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className={cn('text-center font-heading font-semibold tabular-nums', compact ? 'w-8 text-sm' : 'w-10')} aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={btn}
        onClick={() => onChange(Number(value) + 1)}
        disabled={disabled || (max != null && Number(value) >= max)}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
