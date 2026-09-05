import React from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import { matchesSearch } from '@/lib/categories';
import { formatMoney } from '@/lib/pricing';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function HeaderSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebouncedValue(query, 200);
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
    enabled: open,
  });
  const products = Array.isArray(data) ? data : [];
  const results = debounced.trim()
    ? products.filter((product) => matchesSearch(product, debounced)).slice(0, 8)
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-[10px]" aria-label="Search products">
          <Search className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Search products</DialogTitle>
          <DialogDescription>Find products by name, category, or description.</DialogDescription>
        </DialogHeader>
        <div className="relative border-b border-border p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands or categories..."
            className="h-11 rounded-[10px] pl-9 pr-9"
            aria-label="Search products"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {!debounced.trim() ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Start typing to search the shop.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No products found for “{debounced}”.</p>
          ) : (
            <ul>
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    to={`/product/${product.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-[10px] p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="product-image-frame h-12 w-12 shrink-0 overflow-hidden rounded-md p-1">
                      {product.image_url ? (
                        <img
                          src={productImageSrc(product.image_url)}
                          alt=""
                          className="h-full w-full object-contain"
                          onError={productImageFallback}
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{product.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
