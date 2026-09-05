import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { categoryLabel } from '@/lib/categories';
import { useCart } from '@/lib/cart';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import PriceDisplay from '@/components/PriceDisplay';
import { toast } from 'sonner';

function ProductCard({ product }) {
  const customer = getCustomer();
  const { addItem } = useCart();
  const hasCard = isCardActive(customer);
  const inStock = product.in_stock !== false;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    addItem(product, 1);
    toast.success('Added to cart', { description: product.name });
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-subtle transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lift">
      <Link to={`/product/${product.id}`} className="flex min-h-0 flex-1 flex-col">
        <div className="product-image-frame relative overflow-hidden p-3">
          {product.image_url ? (
            <img
              src={productImageSrc(product.image_url)}
              alt={product.name}
              loading="lazy"
              className="transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"
              onError={productImageFallback}
            />
          ) : (
            <span className="text-sm text-muted-foreground">No photo</span>
          )}
          {!inStock ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="font-heading font-semibold text-white">Out of stock</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-3 pb-0">
          {product.category ? (
            <p className="text-caption mb-1 truncate uppercase tracking-wide">{categoryLabel(product.category)}</p>
          ) : null}
          <h3 className="font-heading line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
            {product.name}
          </h3>
          <div className="mt-auto pt-2">
            <PriceDisplay price={product.price} hasCard={hasCard} compact />
          </div>
        </div>
      </Link>
      <div className="p-3 pt-2">
        <Button
          size="sm"
          className="h-10 w-full rounded-[10px] font-heading"
          onClick={handleAdd}
          disabled={!inStock}
        >
          <ShoppingCart className="h-4 w-4" />
          {inStock ? 'Add to Cart' : 'Out of stock'}
        </Button>
      </div>
    </Card>
  );
}

export default React.memo(ProductCard);
