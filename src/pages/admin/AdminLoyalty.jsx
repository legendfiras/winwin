import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { invokeAdmin } from '@/lib/customerAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'EXPIRING_SOON', label: 'Expiring soon' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'NONE', label: 'No membership' },
];

export default function AdminLoyalty() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [datesRow, setDatesRow] = useState(null);
  const [activatedAt, setActivatedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['memberships', filter],
    queryFn: async () => {
      const res = await invokeAdmin('listMemberships', { filter });
      return res?.rows || [];
    },
  });

  const activateMut = useMutation({
    mutationFn: (customer_id) => invokeAdmin('activateMembership', { customer_id }),
    onSuccess: (data) => {
      if (data?.error) return toast.error(data.error);
      toast.success('Membership activated for 30 months. +100 points logged.');
      qc.invalidateQueries({ queryKey: ['memberships'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (customer_id) => invokeAdmin('deactivateMembership', { customer_id }),
    onSuccess: (data) => {
      if (data?.error) return toast.error(data.error);
      toast.success('Membership deactivated.');
      qc.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  const datesMut = useMutation({
    mutationFn: (payload) => invokeAdmin('updateMembershipExpiry', payload),
    onSuccess: (data) => {
      if (data?.error) return toast.error(data.error);
      toast.success('Dates updated.');
      setDatesRow(null);
      qc.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">Loyalty memberships</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      <div className="space-y-3">
        {rows.map(row => {
          const c = row.customer || {};
          return (
            <Card key={c.id}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-heading font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                  </div>
                  <Badge variant={row.status === 'ACTIVE' ? 'default' : row.status === 'EXPIRING_SOON' ? 'secondary' : row.status === 'EXPIRED' ? 'destructive' : 'outline'}>
                    {row.status === 'NONE' ? 'No membership' : row.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Activated: {row.activated_at ? new Date(row.activated_at).toLocaleDateString() : '—'}
                  {' · '}Expires: {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '—'}
                  {row.status === 'ACTIVE' || row.status === 'EXPIRING_SOON' ? ` · ${row.days_remaining} days left` : ''}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(row.status === 'NONE' || row.status === 'EXPIRED') && (
                    <Button size="sm" onClick={() => activateMut.mutate(c.id)}>Activate (30 months)</Button>
                  )}
                  {(row.status === 'ACTIVE' || row.status === 'EXPIRING_SOON') && (
                    <Button size="sm" variant="destructive" onClick={() => deactivateMut.mutate(c.id)}>Deactivate</Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDatesRow(row);
                      setActivatedAt(row.activated_at ? String(row.activated_at).split('T')[0] : '');
                      setExpiresAt(row.expires_at ? String(row.expires_at).split('T')[0] : '');
                    }}
                  >
                    Edit dates
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No customers in this filter.</p>
        )}
      </div>

      <Dialog open={Boolean(datesRow)} onOpenChange={() => setDatesRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit membership dates — {datesRow?.customer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Activation date</Label>
              <Input type="date" value={activatedAt} onChange={e => setActivatedAt(e.target.value)} />
            </div>
            <div>
              <Label>Expiration date</Label>
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={datesMut.isPending}
              onClick={() => datesMut.mutate({
                customer_id: datesRow.customer.id,
                membership_id: datesRow.membership?.id,
                activated_at: activatedAt,
                expires_at: expiresAt,
              })}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
