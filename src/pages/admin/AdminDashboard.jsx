import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { store } from '@/api/store';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Package, Users, Star, MessageSquare, ClipboardList, Database } from 'lucide-react';
import { toast } from 'sonner';
import { invokeAdmin } from '@/lib/customerAuth';

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [feedbackText, setFeedbackText] = useState('');
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const { data: pending = [] } = useQuery({
    queryKey: ['storeTransactions', 'PENDING'],
    queryFn: async () => {
      const res = await invokeAdmin('listPendingTransactions', { status: 'PENDING' });
      return res?.transactions || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => store.products.list(),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => [],
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => store.settings.list(),
  });

  React.useEffect(() => {
    const fb = settings.find(s => s.setting_key === 'customer_feedback');
    if (fb) setFeedbackText(fb.setting_value || '');
  }, [settings]);

  const saveFeedback = async () => {
    setSaving(true);
    await store.settings.upsert('customer_feedback', feedbackText);
    qc.invalidateQueries({ queryKey: ['appSettings'] });
    toast.success('Feedback saved!');
    setSaving(false);
  };

  const cardMembers = customers.filter(c => c.has_winwin_card).length;

  const stats = [
    { label: 'Products', value: products.length, icon: Package, color: 'text-primary' },
    { label: 'Customers', value: customers.length, icon: Users, color: 'text-blue-500' },
    { label: 'WinWin Members', value: cardMembers, icon: Star, color: 'text-yellow-500' },
    { label: 'Pending txns', value: pending.length, icon: ClipboardList, color: 'text-amber-500' },
  ];

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6 text-center">
              <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-2`} />
              <div className="font-heading font-bold text-3xl">{stat.value}</div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <Button asChild>
          <Link to="/admin/pending">Review pending transactions</Link>
        </Button>
        <Button
          variant="outline"
          disabled={migrating}
          onClick={async () => {
            setMigrating(true);
            try {
              const data = await invokeAdmin('migrateLegacyBalances');
              if (data?.error) toast.error(data.error);
              else toast.success(`Migration done. Balances: ${data.migrated_balances}, passwords hashed: ${data.hashed_passwords}, memberships: ${data.imported_memberships}`);
            } catch (err) {
              toast.error(err.message || 'Migration failed');
            } finally {
              setMigrating(false);
            }
          }}
        >
          <Database className="w-4 h-4 mr-2" />
          {migrating ? 'Migrating...' : 'Migrate legacy balances'}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Customer Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Enter feedback or announcements for customers..."
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            rows={4}
            className="resize-y"
          />
          <Button onClick={saveFeedback} disabled={saving}>
            {saving ? 'Saving...' : 'Save Feedback'}
          </Button>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
