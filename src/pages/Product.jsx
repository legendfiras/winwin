import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import Storefront from '@/components/Storefront';
import Container from '@/components/Container';
import PriceDisplay from '@/components/PriceDisplay';
import QuantitySelector from '@/components/QuantitySelector';
import EmptyState from '@/components/EmptyState';
import { useCart } from '@/lib/cart';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { categoryLabel } from '@/lib/categories';
import { pointsForPurchaseUsd } from '@/lib/pointsTiers';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ShoppingCart, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function Product() {
  const { id } = useParams();
  const { addItem } = useCart();
  const customer = getCustomer();
  const hasCard = isCardActive(customer);
  const [qty, setQty] = useState(1);

  const { data: productsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
  });
  const products = Array.isArray(productsData) ? productsData : [];
  const product = products.find((p) => String(p.id) === String(id));
  const inStock = product && product.in_stock !== false;
  const earnPoints = product ? pointsForPurchaseUsd(product.price) : 0;

  useEffect(() => {
    if (product?.name) document.title = `${product.name} | WinWin`;
    return () => {
      document.title = 'WinWin.leb';
    };
  }, [product?.name]);

  const handleAdd = () => {
    if (!product || !inStock) return;
    addItem(product, qty);
    toast.success('Added to cart', { description: product.name });
  };

  return (
    <Storefront>
      <Container as="main" className="py-6 md:py-8">
        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="product-image-frame rounded-[18px]" />
            <div className="space-y-4">
              <div className="h-8 w-2/3 rounded-md bg-muted" />
              <div className="h-10 w-32 rounded-md bg-muted" />
              <div className="h-24 rounded-md bg-muted" />
            </div>
          </div>
        ) : isError ? (
          <EmptyState
            title="Something went wrong."
            description="We couldn't load this product."
            actionLabel="Try Again"
            onAction={() => refetch()}
          />
        ) : !product ? (
          <EmptyState
            icon={ShoppingBag}
            title="Product not found"
            description="It may have been removed from the shop."
            actionLabel="Browse Products"
            to="/"
          />
        ) : (
          <div className="space-y-8">
            <nav className="text-caption" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1">
                <li><Link to="/" className="hover:text-primary">Home</Link></li>
                {product.category ? (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link to={`/?cat=${product.category}`} className="hover:text-primary">
                        {categoryLabel(product.category)}
                      </Link>
                    </li>
                  </>
                ) : null}
                <li aria-hidden="true">/</li>
                <li className="text-foreground">{product.name}</li>
              </ol>
            </nav>

            <div className="grid items-start gap-8 md:grid-cols-2">
              <div className="product-image-frame relative overflow-hidden rounded-[18px] p-6 shadow-subtle">
                {product.image_url ? (
                  <img
                    src={productImageSrc(product.image_url)}
                    alt={product.name}
                    className="max-h-full"
                    onError={productImageFallback}
                  />
                ) : (
                  <span className="text-muted-foreground">No photo</span>
                )}
                {!inStock ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="font-heading text-xl font-bold text-white">Out of stock</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-5">
                <p className="text-caption uppercase tracking-wide">{categoryLabel(product.category)}</p>
                <h1 className="text-h1 leading-tight">{product.name}</h1>
                <PriceDisplay price={product.price} hasCard={hasCard} />
                {customer && earnPoints > 0 ? (
                  <p className="text-sm text-muted-foreground">Earn +{earnPoints} pts on this purchase</p>
                ) : null}

                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4 text-primary" />
                  {inStock ? 'In stock' : 'Out of stock'}
                  {hasCard ? ' · Free delivery with WinWin' : ' · Free delivery with WinWin Card'}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">Quantity</span>
                  <QuantitySelector value={qty} onChange={setQty} disabled={!inStock} />
                </div>

                <Button
                  size="lg"
                  className="h-12 w-full rounded-[10px] text-base font-heading"
                  onClick={handleAdd}
                  disabled={!inStock}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {inStock ? 'Add to Cart' : 'Out of stock'}
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-[10px] text-base">
                  <Link to="/cart">View cart</Link>
                </Button>

                {product.description ? (
                  <div className="border-t border-border pt-5">
                    <h2 className="text-h3 mb-2">Description</h2>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/80">
                      {product.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Container>
    </Storefront>
  );
}
