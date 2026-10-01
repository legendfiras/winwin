import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { activationPath } from '@/lib/accountGuards';
import { getCustomer, invokeCustomer, setCustomer } from '@/lib/customerAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EXCLUDED_PATHS = ['/auth', '/forgot-password', '/reset-password', '/recover-account', '/review-profile'];

function canPrompt(customer, pathname) {
  if (!customer?.id || !customer.email) return false;
  if (customer.account_status && customer.account_status !== 'active') return false;
  if (!['valid', 'unverified', 'verified'].includes(customer.email_status)) return false;
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) return false;
  if (activationPath(customer)) return false;
  return !customer.marketing_emails_enabled
    && !customer.marketing_prompt_shown_at
    && !customer.marketing_prompt_dismissed_at
    && !customer.marketing_subscribed_at
    && !customer.marketing_unsubscribed_at;
}

export default function MarketingEmailPrompt() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const customer = getCustomer();
    if (!canPrompt(customer, location.pathname) || shownRef.current) return;
    shownRef.current = true;
    setOpen(true);
    invokeCustomer('recordMarketingPrompt', { action: 'shown' }).then((data) => {
      if (data?.customer) setCustomer(data.customer);
    }).catch(() => {
      // The choice remains optional and never blocks account use.
    });
  }, [location.pathname]);

  const subscribe = async () => {
    setSubscribing(true);
    try {
      const data = await invokeCustomer('updateMarketingPreference', { marketing_emails_enabled: true });
      if (data?.error) throw new Error(data.error);
      if (data.customer) setCustomer(data.customer);
      setOpen(false);
      toast.success('WinWin email updates are enabled.');
    } catch (error) {
      toast.error(error.message || 'Could not enable email updates.');
    } finally {
      setSubscribing(false);
    }
  };

  const dismiss = () => {
    setOpen(false);
    const cached = getCustomer();
    if (cached) setCustomer({ ...cached, marketing_prompt_dismissed_at: new Date().toISOString() });
    invokeCustomer('recordMarketingPrompt', { action: 'dismissed' }).then((data) => {
      if (data?.customer) setCustomer(data.customer);
    }).catch(() => {
      // Declining email updates must not interrupt the account experience.
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !subscribing) dismiss(); }}>
      <DialogContent className="max-w-sm overflow-hidden border-primary/15 p-0">
        <div className="bg-gradient-to-br from-primary/15 via-background to-amber-50 px-6 pb-5 pt-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Mail className="h-6 w-6" />
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="font-heading text-2xl">Stay updated with WinWin</DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-6">
              Get reminders about your points, account rewards, and newly listed items.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-6 pb-6">
          <Button className="w-full" onClick={subscribe} disabled={subscribing}>
            <Sparkles className="mr-2 h-4 w-4" />
            {subscribing ? 'Enabling updates...' : 'Get updates by email'}
          </Button>
          <Button className="w-full" variant="ghost" onClick={dismiss} disabled={subscribing}>
            Not now
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Optional email updates only. Password reset and required account emails are unaffected.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
