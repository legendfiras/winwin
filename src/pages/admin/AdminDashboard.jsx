import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { store, asProducts } from '@/api/store';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Users, Star, Package } from 'lucide-react';
import { invokeAdmin } from '@/lib/customerAuth';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await invokeAdmin('adminStats');
      return res?.error ? {} : (res || {});
    },
  });
  const { data: productsData } = useQuery({
    queryKey: ['catalog', 1, '', '', 'featured'],
    queryFn: () => store.products.list({ page: 1, limit: 1 }),
  });
  const productsCount = Number(productsData?.total) || asProducts(productsData).length;
  const cards = [
    { label: 'Orders waiting', value: stats?.pending_orders ?? '—', icon: ClipboardList, to: '/admin/pending' },
    { label: 'Customers', value: stats?.customers ?? '—', icon: Users, to: '/admin/customers' },
    { label: 'Active cards', value: stats?.active_cards ?? '—', icon: Star, to: '/admin/loyalty' },
    { label: 'Products', value: productsCount, icon: Package, to: '/admin/products' },
  ];

  return (
    <AdminLayout>
      <h1 className="mb-2 font-heading text-2xl font-bold">Dashboard</h1>
      <p className="mb-4 max-w-xl text-sm text-muted-foreground">
        These counts come from the database. Approve deliveries from the order queue.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((stat) => (
          <Link key={stat.label} to={stat.to}>
            <Card className="h-full">
              <CardContent className="px-3 pb-4 pt-4 text-center">
                <stat.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
                <div className="font-heading text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Button asChild className="h-11 w-full sm:w-auto">
        <Link to="/admin/pending">Open the order queue</Link>
      </Button>
    </AdminLayout>
  );
}
