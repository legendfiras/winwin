import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { store } from '@/api/store';
import { useEarnSettings } from '@/lib/useSettings';
import {
  DEFAULT_POINTS_EARN_MIN_USD,
  DEFAULT_POINTS_EARN_PER_USD,
  POINTS_EARN_MIN_USD_KEY,
  POINTS_EARN_PER_USD_KEY,
  formatPoints,
  pointsForPurchaseUsd,
} from '@/lib/pointsTiers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PointsEarnSettings() {
  const qc = useQueryClient();
  const { pointsPerUsd, minUsd, isLoading } = useEarnSettings();
  const [rate, setRate] = useState(String(DEFAULT_POINTS_EARN_PER_USD));
  const [minPurchase, setMinPurchase] = useState(String(DEFAULT_POINTS_EARN_MIN_USD));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setRate(String(pointsPerUsd));
      setMinPurchase(String(minUsd));
    }
  }, [isLoading, pointsPerUsd, minUsd]);

  const previewSettings = {
    pointsPerUsd: Number(rate),
    minUsd: Number(minPurchase),
  };
  const preview20 = pointsForPurchaseUsd(20, previewSettings);
  const preview50 = pointsForPurchaseUsd(50, previewSettings);

  const handleSave = async (e) => {
    e.preventDefault();
    const nextRate = Number(rate);
    const nextMin = Number(minPurchase);
    if (!Number.isFinite(nextRate) || nextRate < 0) {
      toast.error('Enter a valid points-per-USD rate (0 or more).');
      return;
    }
    if (!Number.isFinite(nextMin) || nextMin < 0) {
      toast.error('Enter a valid minimum purchase amount.');
      return;
    }
    setSaving(true);
    try {
      await store.settings.upsert(POINTS_EARN_PER_USD_KEY, String(nextRate));
      await store.settings.upsert(POINTS_EARN_MIN_USD_KEY, String(nextMin));
      qc.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Points earn rate saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save points rate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
          <Coins className="h-5 w-5 shrink-0 text-primary" />
          Points from purchases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When a customer buys, points awarded = purchase USD × this rate. Example: rate 1 means $20 = 20 points.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="points-per-usd">Points per $1 spent</Label>
              <Input
                id="points-per-usd"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="points-min-usd">Minimum purchase to earn ($)</Label>
              <Input
                id="points-min-usd"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={minPurchase}
                onChange={(e) => setMinPurchase(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            Preview: $20 → <strong>{formatPoints(preview20)}</strong>
            {' · '}
            $50 → <strong>{formatPoints(preview50)}</strong>
            {Number(minPurchase) > 0 ? ` · under $${Number(minPurchase)} earns 0` : ''}
          </p>
          <Button type="submit" className="w-full sm:w-auto" disabled={saving || isLoading}>
            {saving ? 'Saving...' : 'Save points rate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
