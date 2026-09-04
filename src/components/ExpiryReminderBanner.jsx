import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function ExpiryReminderBanner({ customer }) {
  if (!customer?.card_expiring_soon || !customer?.card_active) return null;
  const days = customer.card_days_left;
  const label = days === 1
    ? 'Your Win-Win loyalty membership expires in 1 day.'
    : 'Your Win-Win loyalty membership expires in 2 days.';
  return (
    <Card className="border-amber-400 bg-amber-50/70">
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-amber-800">{label}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Renew now to keep 15% off and free delivery.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
