import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import Navbar from '@/components/Navbar';
import MobileHeader from '@/components/MobileHeader';
import HeroSlideshow from '@/components/HeroSlideshow';
import CategoryFilter from '@/components/CategoryFilter';
import ProductSearchBar from '@/components/ProductSearchBar';
import ProductCard from '@/components/ProductCard';
import PullToRefresh from '@/components/PullToRefresh';
import WinWinCardBanner from '@/components/WinWinCardBanner';
import WhatsAppButton from '@/components/WhatsAppButton';
import CustomerFeedback from '@/components/CustomerFeedback';
import MobileBottomTab from '@/components/MobileBottomTab';
import { useSettings } from '@/lib/useSettings';
import { Loader2 } from 'lucide-react';
import { getCustomer, getSessionToken, invokeCustomer } from '@/lib/customerAuth';
import ExpiryReminderBanner from '@/components/ExpiryReminderBanner';

const FILTER_STORAGE_KEY = 'home_category_filter';

export default function Home() {
  const { getSetting } = useSettings();
  const bgColor = getSetting('background_color', '#FFF8F0');

  // Restore category filter from sessionStorage
  const [category, setCategory] = useState(() => {
    try {
      return sessionStorage.getItem(FILTER_STORAGE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  // Persist category filter on change
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, cat);
    } catch {}
  };

  const [search, setSearch] = useState('');
  const [account, setAccount] = useState(getCustomer());

  useEffect(() => {
    if (!getSessionToken()) return;
    invokeCustomer('getMyAccount').then((data) => {
      if (data?.customer) setAccount(data.customer);
    }).catch(() => {});
  }, []);

  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
  });
  const products = Array.isArray(productsData) ? productsData : [];

  const filtered = products.filter(p => {
    const inCategory = category === 'all' || p.category === category;
    if (!inCategory) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (p.name || '').toLowerCase().includes(q) ||
           (p.description || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ backgroundColor: bgColor }}>
      <div className="hidden md:block"><Navbar /></div>
      <MobileHeader title="WinWin.leb" showBack={false} />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <HeroSlideshow />
        {account?.card_expiring_soon && <ExpiryReminderBanner customer={account} />}
        <CustomerFeedback />
        <WinWinCardBanner />
        <div>
          <h2 className="font-heading font-bold text-2xl mb-4">Browse Products</h2>
          <ProductSearchBar value={search} onChange={setSearch} />
          <CategoryFilter active={category} onChange={handleCategoryChange} />
        </div>
        <PullToRefresh onRefresh={refetch}>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {search.trim() ? 'No products match your search.' : 'No products in this category yet.'}
                </div>
              )}
            </div>
          )}
        </PullToRefresh>
      </main>
      <MobileBottomTab />
      <WhatsAppButton />
    </div>
  );
}