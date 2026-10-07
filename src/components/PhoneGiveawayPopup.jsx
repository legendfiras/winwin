import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SESSION_KEY = 'winwin_phone_giveaway_dismissed';
let dismissedInMemory = false;

function dismissed() {
  if (dismissedInMemory) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal() {
  dismissedInMemory = true;
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Private browsing can block storage; the in-memory flag still lasts for this page view.
  }
}

function isCustomerPage(pathname) {
  if (pathname === '/admin-login' || pathname.startsWith('/admin')) return false;
  const hidden = ['/forgot-password', '/reset-password', '/verify-email', '/recover-account', '/review-profile', '/unsubscribe'];
  return !hidden.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function PhoneGiveawayPopup() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isCustomerPage(location.pathname) || dismissed()) return;
    rememberDismissal();
    setOpen(true);
  }, [location.pathname]);

  const close = () => {
    rememberDismissal();
    setOpen(false);
  };

  const shopNow = () => {
    close();
    if (location.pathname === '/') {
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate('/#shop');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden border-[#9F1D35]/15 bg-[#FAF6EF] p-0 sm:rounded-2xl"
        closeClassName="right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#321A19] opacity-100 shadow-md ring-1 ring-[#321A19]/10 hover:bg-[#F5EDE1] focus:ring-offset-[#FAF6EF] [&_svg]:h-5 [&_svg]:w-5"
      >
        <div className="h-1.5 bg-gradient-to-r from-[#9F1D35] via-[#C7952E] to-[#9F1D35]" />
        <div className="space-y-4 px-5 pb-5 pt-5">
          <BrandLogo className="h-9 w-[132px]" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C7952E]/20 text-[#9F1D35]">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogHeader className="space-y-2 pr-8 text-left">
            <DialogTitle className="font-heading text-2xl leading-tight text-[#321A19]">
              Shop & Win a New Phone!
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#81776E]">
              Spend $20 on items to get 1 entry into our phone giveaway. Every additional $20 gives you another entry!
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-[12px] bg-[#C7952E]/15 px-3 py-2 text-center text-sm font-medium leading-6 text-[#321A19]">
            $20 = 1 entry • $40 = 2 entries • $60 = 3 entries
          </p>
          <p className="text-sm leading-6 text-[#81776E]">
            Enter winwin-phone at checkout to participate.
          </p>
          <Button type="button" className="h-12 w-full rounded-[10px] text-base" onClick={shopNow}>
            Shop Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
