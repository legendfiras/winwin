import React from 'react';
import { Link } from 'react-router-dom';
import Storefront from '@/components/Storefront';
import Container from '@/components/Container';
import QuantitySelector from '@/components/QuantitySelector';
import EmptyState from '@/components/EmptyState';
import { useCart } from '@/lib/cart';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { cartTotals, formatMoney, lineTotal } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { MessageCircle, ShoppingBag, Trash2 } from 'lucide-react';

export default function Cart() {
  const { items, setQty, removeItem, count, openCheckout } = useCart();
  const customer = getCustomer();
  const hasCard = isCardActive(customer);
  const totals = cartTotals(items, hasCard);

  return (
    <Storefront>
      <Container as="main" className="max-w-3xl py-6 md:py-8">
        <h1 className="text-h1 mb-6">Your Cart</h1>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty."
            description="Browse the shop and add something you like."
            actionLabel="Browse Products"
            to="/"
          />
        ) : (
          <div className="space-y-6">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-white p-3 shadow-subtle">
                  <Link to={`/product/${item.id}`} className="product-image-frame h-20 w-20 shrink-0 overflow-hidden rounded-[10px] p-1">
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
                    <Link to={`/product/${item.id}`} className="font-heading line-clamp-2 font-semibold text-foreground hover:text-primary">
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price)} each</p>
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
                  <div className="font-heading font-bold tabular-nums text-foreground">
                    {formatMoney(lineTotal(item.price, item.qty))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 rounded-[18px] border border-border bg-white p-5 shadow-subtle">
              <div className="flex justify-between text-muted-foreground">
                <span>{count} item{count === 1 ? '' : 's'}</span>
                <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
              </div>
              {hasCard ? (
                <div className="flex justify-between font-medium text-primary">
                  <span>WinWin Savings</span>
                  <span className="tabular-nums">-{formatMoney(totals.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-3 font-heading text-xl font-bold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(totals.total)}</span>
              </div>
              <Button className="h-12 w-full rounded-[10px] text-base" onClick={openCheckout}>
                <MessageCircle className="h-5 w-5" />
                Checkout
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Your order is sent to the WinWin dashboard for approval, then confirmed on WhatsApp.
              </p>
            </div>
          </div>
        )}
      </Container>
    </Storefront>
  );
}
