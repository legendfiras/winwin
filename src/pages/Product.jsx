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
import { canRedeemProduct, formatPoints, pointsForPurchaseUsd, productPointsCost } from '@/lib/pointsTiers';
import { openRedeemWhatsApp, redeemProductRequest } from '@/lib/redeemProduct';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { useSettings } from '@/lib/useSettings';
import ProductPointsInfo from '@/components/ProductPointsInfo';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Gift, ShoppingBag, ShoppingCart, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function Product() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { getSetting } = useSettings();
  const [customer, setCustomer] = useState(getCustomer());
  const hasCard = isCardActive(customer);
  const [qty, setQty] = useState(1);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const { data: productsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
  });
  const products = Array.isArray(productsData) ? productsData : [];
  const product = products.find((p) => String(p.id) === String(id));
  const inStock = product && product.in_stock !== false;
  const earnPoints = product ? pointsForPurchaseUsd(product.price) : 0;
  const redeemCost = product ? productPointsCost(product) : 0;
  const canRedeem = product ? canRedeemProduct(product, customer) : false;

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

  const handleRedeem = async () => {
    if (!product || !canRedeem || redeeming) return;
    setRedeeming(true);
    try {
      const data = await redeemProductRequest(product);
      if (data?.customer) setCustomer(data.customer);
      setRedeemOpen(false);
      toast.success(`"${product.name}" redeemed! ${data.points_used} points deducted. We'll contact you soon!`);
      openRedeemWhatsApp({
        product,
        customer: data?.customer || customer,
        pointsUsed: data.points_used,
        remaining: data.customer?.points,
        whatsappNumber: getSetting('whatsapp_number', '0096178714472'),
      });
    } catch (err) {
      toast.error(err.message || 'Redemption failed. Try again.');
    } finally {
      setRedeeming(false);
    }
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
                <ProductPointsInfo product={product} customer={customer} />
                {earnPoints > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {customer
                      ? `Earn +${earnPoints} pts when you buy this (orders of $15+).`
                      : `Earn +${earnPoints} pts on this purchase when you sign in (orders of $15+).`}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Point rewards start on purchases of $15 or more.</p>
                )}

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
                {canRedeem ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-12 w-full rounded-[10px] text-base font-heading"
                    onClick={() => setRedeemOpen(true)}
                    disabled={redeeming}
                  >
                    <Gift className="h-5 w-5" />
                    Redeem for {formatPoints(redeemCost)}
                  </Button>
                ) : customer ? (
                  <Button asChild variant="outline" className="h-12 w-full rounded-[10px] text-base">
                    <Link to="/my-account">View my points</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="h-12 w-full rounded-[10px] text-base">
                    <Link to="/auth">Sign in to redeem</Link>
                  </Button>
                )}
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

            <AlertDialog open={redeemOpen} onOpenChange={setRedeemOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Redeem this item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Use {formatPoints(redeemCost)} to get “{product.name}” for free. Your remaining balance will be {formatPoints((Number(customer?.points) || 0) - redeemCost)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={redeeming}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleRedeem();
                    }}
                    disabled={redeeming}
                  >
                    {redeeming ? 'Redeeming…' : 'Confirm redeem'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </Container>
    </Storefront>
  );
}
