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

function statusBadge(status) {
  if (status === 'APPROVED') return <Badge className="bg-green-600">Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>;
  if (status === 'COMPLETED') return <Badge variant="secondary">Completed</Badge>;
  return <Badge className="bg-amber-500">Pending</Badge>;
}

export default function AdminRecovery() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PENDING');
  const [detail, setDetail] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [attachId, setAttachId] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['recoveryRequests', tab],
    queryFn: async () => {
      const res = await invokeAdmin('listRecoveryRequests', { status: tab === 'ALL' ? undefined : tab });
      return res?.requests || [];
    },
  });

  const reviewMut = useMutation({
    mutationFn: (payload) => invokeAdmin('reviewRecoveryRequest', {
      ...payload,
      app_origin: window.location.origin,
    }),
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['recoveryRequests'] });
      setDetail(null);
      setRejectOpen(null);
      setRejectReason('');
      setAttachId('');
    },
  });

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">Account Recovery Requests</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'ALL'].map((s) => (
          <Button key={s} size="sm" variant={tab === s ? 'default' : 'outline'} onClick={() => setTab(s)}>
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      <div className="space-y-3">
        {requests.map((row) => (
          <Card key={row.id}>
            <CardContent className="pt-5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.submitted_name || row.customer?.full_name || 'Unknown name'}</p>
                  <p className="text-sm text-muted-foreground">New email: {row.requested_email}</p>
                  <p className="text-xs text-muted-foreground">{row.created_date}</p>
                </div>
                {statusBadge(row.status)}
              </div>
              <p className="text-sm">Phone: {row.submitted_phone || '—'}</p>
              <p className="text-sm">Legacy ID: {row.submitted_legacy_id || '—'}</p>
              <p className="text-sm">Card: {row.submitted_card_number || '—'}</p>
              {row.customer ? (
                <p className="text-sm">
                  Points: {row.customer.points} · Card: {row.customer.has_winwin_card ? 'Yes' : 'No'}
                </p>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => { setDetail(row); setAttachId(row.customer_id || ''); }}>
                  View Details
                </Button>
                {row.status === 'PENDING' ? (
                  <>
                    <Button size="sm" onClick={() => reviewMut.mutate({ request_id: row.id, action: 'approve', customer_id: row.customer_id })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectOpen(row)}>
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={() => setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Recovery request</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-2 text-sm">
              <p>Request ID: {detail.id}</p>
              <p>Customer ID: {detail.customer_id || 'Unmatched'}</p>
              <p>Legacy ID submitted: {detail.submitted_legacy_id || '—'}</p>
              <p>Old email: {detail.customer?.email || '—'}</p>
              <p>Requested email: {detail.requested_email}</p>
              <p>Phone submitted: {detail.submitted_phone || '—'}</p>
              <p>Card submitted: {detail.submitted_card_number || '—'}</p>
              <p>Match notes: {detail.match_notes || '—'}</p>
              {detail.customer ? (
                <>
                  <p>Name: {detail.customer.full_name}</p>
                  <p>Points: {detail.customer.points}</p>
                  <p>Loyalty: {detail.customer.has_winwin_card ? `Card ${detail.customer.card_number || ''}` : 'None'}</p>
                  <p>Migration: {detail.customer.migration_status}</p>
                </>
              ) : null}
              {!detail.customer_id ? (
                <div className="space-y-2 pt-2">
                  <Label>Attach customer ID</Label>
                  <Input value={attachId} onChange={(e) => setAttachId(e.target.value)} />
                </div>
              ) : null}
              {detail.status === 'PENDING' ? (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => reviewMut.mutate({
                      request_id: detail.id,
                      action: 'approve',
                      customer_id: attachId || detail.customer_id,
                    })}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(detail)}>Reject</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectOpen)} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reject request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button
              variant="destructive"
              onClick={() => reviewMut.mutate({
                request_id: rejectOpen.id,
                action: 'reject',
                reject_reason: rejectReason,
              })}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
