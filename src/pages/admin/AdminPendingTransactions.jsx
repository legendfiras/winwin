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

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">Pending Transactions</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
          <Button key={s} size="sm" variant={tab === s ? 'default' : 'outline'} onClick={() => setTab(s)}>
            {s === 'ALL' ? 'All' : s}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      <div className="space-y-3">
        {transactions.map(tx => (
          <Card key={tx.id}>
            <CardContent className="pt-5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-heading font-semibold">{tx.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{tx.customer_email}</p>
                </div>
                {statusBadge(tx.status)}
              </div>
              <p className="text-sm">
                <span className="font-medium">{tx.type === 'LOYALTY_CARD' ? 'WIN-WIN LOYALTY CARD' : 'PRODUCT PURCHASE'}</span>
                {' · '}${Number(tx.amount_usd || 0).toFixed(2)}
                {' · '}
                {tx.type === 'LOYALTY_CARD' ? '100 bonus pts on approval' : formatPoints(tx.calculated_points ?? pointsForPurchaseUsd(tx.amount_usd))}
              </p>
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
        {!isLoading && transactions.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No transactions in this view.</p>
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
              <p><strong>Email:</strong> {detail.customer_email}</p>
              <p><strong>Type:</strong> {detail.type}</p>
              <p><strong>Amount:</strong> ${Number(detail.amount_usd || 0).toFixed(2)}</p>
              <p><strong>Points on approval:</strong> {detail.type === 'LOYALTY_CARD' ? 100 : (detail.calculated_points ?? pointsForPurchaseUsd(detail.amount_usd))}</p>
              <p><strong>Status:</strong> {detail.status}</p>
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
