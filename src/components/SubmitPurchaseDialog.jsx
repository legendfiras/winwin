import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invokeCustomer, getCustomer } from '@/lib/customerAuth';
import { pointsForPurchaseUsd, formatPoints } from '@/lib/pointsTiers';
import { toast } from 'sonner';

export default function SubmitPurchaseDialog({ open, onOpenChange, product, onSubmitted }) {
  const customer = getCustomer();
  const [amount, setAmount] = useState(product?.price ? String(product.price) : '');
  const [note, setNote] = useState(product?.name || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(product?.price ? String(product.price) : '');
      setNote(product?.name || '');
    }
  }, [open, product]);

  const usd = Number(amount);
  const pendingPoints = Number.isFinite(usd) ? pointsForPurchaseUsd(usd) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer) {
      toast.error('Sign in to submit a purchase.');
      return;
    }
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const data = await invokeCustomer('submitPurchase', {
        amount_usd: usd,
        product_ids: product?.id ? [product.id] : [],
        product_summary: note,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Purchase submitted and is pending admin approval. Points will be added after approval.');
      onOpenChange(false);
      onSubmitted?.(data);
    } catch (err) {
      toast.error(err.message || 'Could not submit purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit purchase for points</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            After you pay via WhatsApp, submit the amount here. An admin must approve it before points are added.
          </p>
          {product?.name && (
            <p className="text-sm font-medium">{product.name}</p>
          )}
          <div>
            <Label>Amount paid (USD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Order details" />
          </div>
          <p className="text-sm">
            Pending reward: <strong>{formatPoints(pendingPoints)}</strong>
            {usd > 0 && usd < 15 ? ' (orders under $15 earn 0 points)' : ''}
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit for approval'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
