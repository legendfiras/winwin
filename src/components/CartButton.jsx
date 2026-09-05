import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CartButton({ className = '' }) {
  const { count, openCart } = useCart();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('relative h-11 w-11 min-h-[44px] min-w-[44px] rounded-[10px]', className)}
      onClick={openCart}
      aria-label={count > 0 ? `Open shopping cart, ${count} items` : 'Open shopping cart'}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Button>
  );
}
