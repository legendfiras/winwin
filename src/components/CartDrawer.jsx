import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { cartTotals, formatMoney, lineTotal } from '@/lib/pricing';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import QuantitySelector from '@/components/QuantitySelector';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export default function CartDrawer() {
  const { items, setQty, removeItem, count, drawerOpen, setDrawerOpen, openCheckout } = useCart();
  const customer = getCustomer();
  const hasCard = isCardActive(customer);
  const totals = cartTotals(items, hasCard);

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <SheetTitle className="font-heading">Your Cart</SheetTitle>
          <SheetDescription>
            {count > 0 ? `${count} item${count === 1 ? '' : 's'}` : 'Add products to get started'}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center px-5">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty."
              description="Browse the shop and add something you like."
              actionLabel="Browse Products"
              to="/"
              onAction={() => setDrawerOpen(false)}
              className="w-full border-0 shadow-none"
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <Link
                      to={`/product/${item.id}`}
                      onClick={() => setDrawerOpen(false)}
                      className="product-image-frame h-16 w-16 shrink-0 overflow-hidden rounded-[10px] p-1"
                    >
                      {item.image_url ? (
                        <img
                          src={productImageSrc(item.image_url)}
                          alt={item.name}
                          className="h-full w-full object-contain"
                          onError={productImageFallback}
                        />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${item.id}`}
                        onClick={() => setDrawerOpen(false)}
                        className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(item.price)} each</p>
                      <div className="mt-2 flex items-center gap-2">
                        <QuantitySelector size="sm" value={item.qty} onChange={(qty) => setQty(item.id, qty)} min={0} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="font-heading text-sm font-semibold tabular-nums">{formatMoney(lineTotal(item.price, item.qty))}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
              </div>
              {hasCard ? (
                <div className="flex justify-between text-sm font-medium text-primary">
                  <span>WinWin Savings</span>
                  <span className="tabular-nums">-{formatMoney(totals.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-heading text-lg font-bold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(totals.total)}</span>
              </div>
              <Button className="h-12 w-full rounded-[10px] bg-green-700 text-white hover:bg-green-800" onClick={openCheckout}>
                <MessageCircle className="h-5 w-5" />
                Checkout
              </Button>
              <Button asChild variant="outline" className="h-11 w-full rounded-[10px]" onClick={() => setDrawerOpen(false)}>
                <Link to="/cart">View full cart</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
