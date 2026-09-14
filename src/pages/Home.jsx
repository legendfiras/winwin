import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { store } from '@/api/store';
import Storefront from '@/components/Storefront';
import Container from '@/components/Container';
import WinWinHero from '@/components/home/WinWinHero';
import CategoryFilter from '@/components/CategoryFilter';
import ProductSearchBar from '@/components/ProductSearchBar';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import CatalogPagination from '@/components/CatalogPagination';
import PullToRefresh from '@/components/PullToRefresh';
import CustomerFeedback from '@/components/CustomerFeedback';
import EmptyState from '@/components/EmptyState';
import { getCustomer, getSessionToken, invokeCustomer } from '@/lib/customerAuth';
import { PRODUCTS_PER_PAGE, SORT_OPTIONS, categoryLabel } from '@/lib/categories';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useEarnSettings } from '@/lib/useSettings';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const rawCat = params.get('cat') || '';
  const category = rawCat === 'all' ? '' : rawCat;
  const sort = params.get('sort') || 'featured';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const qParam = params.get('q') || '';
  const [search, setSearch] = useState(qParam);
  const [account, setAccount] = useState(getCustomer());
  const debouncedSearch = useDebouncedValue(qParam, 200);
  const earn = useEarnSettings();

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      const empty =
        value == null ||
        value === '' ||
        (key === 'page' && Number(value) <= 1) ||
        (key === 'sort' && value === 'featured');
      if (empty) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace: true });
  };

  const handleCategoryChange = (cat) => {
    updateParams({ cat: cat || '', page: 1 });
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    updateParams({ q: value, page: 1 });
  };

  const clearCatalogFilters = () => {
    setSearch('');
    updateParams({ cat: '', q: '', page: 1 });
  };

  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  useEffect(() => {
    if (!getSessionToken()) return;
    invokeCustomer('getMyAccount').then((data) => {
      if (data?.customer) setAccount(data.customer);
    }).catch(() => {});
  }, []);

  const { data: catalog, isLoading, isError, refetch } = useQuery({
    queryKey: ['catalog', page, category, debouncedSearch, sort],
    queryFn: () =>
      store.products.list({
        page,
        limit: PRODUCTS_PER_PAGE,
        cat: category,
        q: debouncedSearch,
        sort,
      }),
    placeholderData: keepPreviousData,
  });

  const products = Array.isArray(catalog?.items) ? catalog.items : [];
  const total = Number(catalog?.total) || 0;
  const pageCount = Number(catalog?.page_count) || 1;
  const currentPage = Number(catalog?.page) || page;
  const categoryCounts = catalog?.category_counts || null;
  const categoryTitle = category ? categoryLabel(category) : null;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const rangeEnd = Math.min(total, currentPage * PRODUCTS_PER_PAGE);

  const handlePageChange = (nextPage) => {
    updateParams({ page: nextPage });
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Storefront>
      <WinWinHero customer={account} />
      <div className="hero-to-shop">
        <Container as="main" className="space-y-6 pb-6 md:space-y-8 md:pb-8">
          <CustomerFeedback />

        <section id="shop" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-h1">
                <button
                  type="button"
                  onClick={clearCatalogFilters}
                  className="rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Shop
                </button>
              </h2>
              <p className="mt-1 text-muted-foreground">
                {categoryTitle
                  ? `Showing ${categoryTitle}.`
                  : `Discover the latest products and WinWin deals. Earn ${earn.pointsPerUsd} ${earn.pointsPerUsd === 1 ? 'point' : 'points'} per $1 spent.`}
                {total > 0 ? (
                  <span className="ml-2 text-sm tabular-nums">
                    {rangeStart}–{rangeEnd} of {total}
                  </span>
                ) : null}
              </p>
            </div>
            <Select value={sort} onValueChange={(value) => updateParams({ sort: value, page: 1 })}>
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

          <ProductSearchBar value={search} onChange={handleSearchChange} />
          <CategoryFilter active={category} onChange={handleCategoryChange} counts={categoryCounts} />
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
          ) : products.length === 0 ? (
            <EmptyState
              icon={Search}
              title={debouncedSearch.trim()
                ? `No products found for “${debouncedSearch.trim()}”`
                : categoryTitle
                  ? `No products are currently available in ${categoryTitle}.`
                  : 'No products are currently available.'}
              description={debouncedSearch.trim() || categoryTitle ? 'Try another search or browse the full catalog.' : undefined}
              actionLabel={debouncedSearch.trim() || categoryTitle ? 'View all products' : undefined}
              onAction={clearCatalogFilters}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 min-[1200px]:grid-cols-4 min-[1440px]:grid-cols-5">
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
              <CatalogPagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </PullToRefresh>
      </Container>
      </div>
    </Storefront>
  );
}
