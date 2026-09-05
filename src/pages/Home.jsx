import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import Storefront from '@/components/Storefront';
import Container from '@/components/Container';
import WinWinHero from '@/components/home/WinWinHero';
import CategoryFilter from '@/components/CategoryFilter';
import ProductSearchBar from '@/components/ProductSearchBar';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import PullToRefresh from '@/components/PullToRefresh';
import CustomerFeedback from '@/components/CustomerFeedback';
import EmptyState from '@/components/EmptyState';
import { getCustomer, getSessionToken, invokeCustomer } from '@/lib/customerAuth';
import { categoryMatches, matchesSearch, sortProducts, SORT_OPTIONS, categoryLabel } from '@/lib/categories';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

const FILTER_STORAGE_KEY = 'home_category_filter';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') || 'featured');
  const [account, setAccount] = useState(getCustomer());
  const debouncedSearch = useDebouncedValue(search, 200);

  const category = params.get('cat') || (() => {
    try {
      return sessionStorage.getItem(FILTER_STORAGE_KEY) || 'all';
    } catch {
      return 'all';
    }
  })();

  const handleCategoryChange = (cat) => {
    const next = new URLSearchParams(params);
    if (!cat || cat === 'all') next.delete('cat');
    else next.set('cat', cat);
    setParams(next, { replace: true });
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, cat);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, category);
    } catch {
      /* ignore */
    }
  }, [category]);

  useEffect(() => {
    if (!getSessionToken()) return;
    invokeCustomer('getMyAccount').then((data) => {
      if (data?.customer) setAccount(data.customer);
    }).catch(() => {});
  }, []);

  const { data: productsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
  });
  const products = Array.isArray(productsData) ? productsData : [];

  const filtered = useMemo(() => {
    const next = products.filter((product) => (
      categoryMatches(product.category, category) && matchesSearch(product, debouncedSearch)
    ));
    return sortProducts(next, sort);
  }, [products, category, debouncedSearch, sort]);

  const categoryTitle = category === 'all' ? null : categoryLabel(category);

  return (
    <Storefront>
      <WinWinHero customer={account} />
      <div className="hero-to-shop">
        <Container as="main" className="space-y-6 pb-6 md:space-y-8 md:pb-8">
          <CustomerFeedback />

        <section id="shop" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-h1">Shop</h2>
              <p className="mt-1 text-muted-foreground">
                Discover the latest products and WinWin deals.
                {products.length > 0 ? (
                  <span className="ml-2 text-sm tabular-nums">{products.length} products</span>
                ) : null}
              </p>
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-11 w-full rounded-[10px] bg-white sm:w-52" aria-label="Sort products">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ProductSearchBar value={search} onChange={setSearch} />
          <CategoryFilter active={category} onChange={handleCategoryChange} />
        </section>

        <PullToRefresh onRefresh={refetch}>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 min-[1200px]:grid-cols-4 min-[1440px]:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              title="Something went wrong."
              description="We couldn't load the products."
              actionLabel="Try Again"
              onAction={() => refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title={debouncedSearch.trim()
                ? `No products found for “${debouncedSearch.trim()}”`
                : categoryTitle
                  ? `No products are currently available in ${categoryTitle}.`
                  : 'No products are currently available in this category.'}
              description={debouncedSearch.trim() ? 'Try another search or browse all products.' : undefined}
              actionLabel={debouncedSearch.trim() ? 'Clear Search' : 'View all products'}
              onAction={() => {
                setSearch('');
                handleCategoryChange('all');
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 min-[1200px]:grid-cols-4 min-[1440px]:grid-cols-5">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </PullToRefresh>
      </Container>
      </div>
    </Storefront>
  );
}
