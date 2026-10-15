import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { invokeAdmin } from '@/lib/customerAuth';
import { pointsForPurchaseUsd, formatPoints } from '@/lib/pointsTiers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function statusBadge(status) {
  if (status === 'APPROVED') return <Badge className="bg-green-600">APPROVED</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive">REJECTED</Badge>;
  if (status === 'PROCESSING') return <Badge variant="secondary">PROCESSING</Badge>;
  return <Badge className="bg-amber-500">PENDING</Badge>;
}

export default function AdminPendingTransactions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['storeTransactions', tab],
    queryFn: async () => {
      const res = await invokeAdmin('listPendingTransactions', { status: tab === 'ALL' ? undefined : tab });
      return res?.transactions || [];
    },
  });

  const approveMut = useMutation({
    mutationFn: (id) => invokeAdmin('approveTransaction', { transaction_id: id }),
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(data.already_approved ? 'Already approved — points were not added twice.' : 'Approved.');
      qc.invalidateQueries({ queryKey: ['storeTransactions'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['adminStats'] });
      setDetail(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reject_reason }) => invokeAdmin('rejectTransaction', { transaction_id: id, reject_reason }),
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Rejected. No points awarded.');
      qc.invalidateQueries({ queryKey: ['storeTransactions'] });
      setRejectOpen(null);
      setDetail(null);
      setRejectReason('');
    },
  });

  const q = search.trim().toLowerCase();
  const visible = transactions.filter((tx) => {
    if (!q) return true;
    const delivery = tx.delivery || {};
    const hay = [
      tx.display_id,
      tx.customer_name,
      tx.customer_phone,
      tx.customer_email,
      tx.product_summary,
      tx.giveaway_code,
      delivery.governorate,
      delivery.street,
      delivery.instructions,
      ...(tx.items || []).map((item) => item.name),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });

  return (
    <AdminLayout>
      <h1 className="mb-1 font-heading text-xl font-bold sm:text-2xl">Orders</h1>
      <p className="mb-4 text-sm text-muted-foreground">Approve a delivery here. Card dates are set from Loyalty when you approve a card order.</p>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, area, or giveaway"
          className="h-11 sm:max-w-sm"
        />
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
          <Button key={s} size="sm" variant={tab === s ? 'default' : 'outline'} onClick={() => setTab(s)}>
            {s === 'ALL' ? 'All' : s}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      <div className="space-y-3">
        {visible.map(tx => (
          <Card key={tx.id}>
            <CardContent className="pt-5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-heading font-semibold">{tx.display_id || tx.id} · {tx.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{tx.customer_phone || tx.customer_email}</p>
                </div>
                {statusBadge(tx.status)}
              </div>
              <p className="text-sm">
                <span className="font-medium">{tx.type === 'LOYALTY_CARD' ? 'WIN-WIN LOYALTY CARD' : 'PRODUCT PURCHASE'}</span>
                {' · '}${Number(tx.amount_usd || 0).toFixed(2)}
                {' · '}
                {tx.type === 'LOYALTY_CARD' ? '100 bonus pts on approval' : formatPoints(tx.calculated_points ?? pointsForPurchaseUsd(tx.amount_usd))}
              </p>
              {(tx.items || []).length > 0 && (
                <p className="text-sm">{tx.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}</p>
              )}
              {tx.delivery && (
                <p className="text-sm text-muted-foreground">
                  Deliver to {[tx.delivery.governorate, tx.delivery.street, tx.delivery.building].filter(Boolean).join(', ') || 'address on file'}
                  {tx.delivery.instructions ? ` · ${tx.delivery.instructions}` : ''}
                </p>
              )}
              {tx.giveaway_code && <p className="text-sm font-medium">Giveaway: {tx.giveaway_code}</p>}
              {tx.product_summary && <p className="text-sm text-muted-foreground">{tx.product_summary}</p>}
              <p className="text-xs text-muted-foreground">
                Submitted {tx.created_date ? new Date(tx.created_date).toLocaleString() : ''} · {tx.submitted_by}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setDetail(tx)}>Details</Button>
                {tx.status === 'PENDING' && (
                  <>
                    <Button size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate(tx.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectOpen(tx); setRejectReason(''); }}>Reject</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && visible.length === 0 && (
          <p className="text-center text-muted-foreground py-10">
            {search.trim() ? 'No orders match that search.' : 'No transactions in this view.'}
          </p>
        )}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={() => setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p><strong>Customer:</strong> {detail.customer_name}</p>
              <p><strong>Phone:</strong> {detail.customer_phone || '—'}</p>
              <p><strong>Email:</strong> {detail.customer_email || '—'}</p>
              {detail.delivery ? (
                <p><strong>Delivery:</strong> {[detail.delivery.governorate, detail.delivery.street, detail.delivery.building, detail.delivery.floor].filter(Boolean).join(', ')}{detail.delivery.instructions ? ` — ${detail.delivery.instructions}` : ''}</p>
              ) : null}
              {detail.giveaway_code ? <p><strong>Giveaway code:</strong> {detail.giveaway_code}</p> : null}
              <p><strong>Order ID:</strong> {detail.display_id || detail.id}</p>
              <p><strong>Type:</strong> {detail.type}</p>
              <p><strong>Amount:</strong> ${Number(detail.amount_usd || 0).toFixed(2)}</p>
              {detail.member_price_requested ? (
                <p><strong>WinWin price:</strong> requested — confirm 15% off when approving</p>
              ) : null}
              <p><strong>Points on approval:</strong> {detail.type === 'LOYALTY_CARD' ? 100 : (detail.calculated_points || pointsForPurchaseUsd(detail.amount_usd))}</p>
              <p><strong>Status:</strong> {detail.status}</p>
              <p><strong>Items:</strong></p>
              <ul className="list-disc pl-5">
                {(detail.items || []).map((item) => (
                  <li key={`${item.id}-${item.qty}`}>{item.qty}× {item.name} — ${Number(item.line_total || (Number(item.price) || 0) * (Number(item.qty) || 0)).toFixed(2)}</li>
                ))}
              </ul>
              <p><strong>Notes:</strong> {detail.product_summary || '—'}</p>
              <p><strong>Submitted:</strong> {detail.created_date ? new Date(detail.created_date).toLocaleString() : '—'}</p>
              <p><strong>Reviewed:</strong> {detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : '—'}</p>
              {detail.reject_reason && <p><strong>Reject reason:</strong> {detail.reject_reason}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectOpen)} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason (optional)</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <Button
              variant="destructive"
              className="w-full"
              disabled={rejectMut.isPending}
              onClick={() => rejectMut.mutate({ id: rejectOpen.id, reject_reason: rejectReason })}
            >
              Confirm reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
