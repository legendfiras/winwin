import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { store } from '@/api/store';
import { getCustomer, setCustomer as saveCustomer, clearCustomer, invokeCustomer, isCardActive } from '@/lib/customerAuth';
import { pointsPriceFromUsd } from '@/lib/pointsTiers';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { useSettings } from '@/lib/useSettings';
import Navbar from '@/components/Navbar';
import MobileHeader from '@/components/MobileHeader';
import PullToRefresh from '@/components/PullToRefresh';
import WhatsAppButton from '@/components/WhatsAppButton';
import MobileBottomTab from '@/components/MobileBottomTab';
import ExpiryReminderBanner from '@/components/ExpiryReminderBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, Trophy, Calendar, LogOut, Gift, ShoppingBag, Trash2, AlertTriangle, Clock, CreditCard, Wallet, History } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function MyAccount() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [customer, setCustomerState] = useState(getCustomer());
  const customerRef = useRef(customer);
  customerRef.current = customer;
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemableProducts, setRedeemableProducts] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { getSetting } = useSettings();

  const refreshCustomer = useCallback(async () => {
    const data = await invokeCustomer('getMyAccount');
    if (data?.error === 'unauthorized' || !data?.customer) {
      clearCustomer();
      navigate('/auth');
      return;
    }
    saveCustomer(data.customer);
    setCustomerState(data.customer);
  }, [navigate]);

  useEffect(() => {
    if (!getCustomer()) {
      navigate('/auth');
      return;
    }
    refreshCustomer();
  }, []);

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger', customer?.id],
    queryFn: async () => {
      const data = await invokeCustomer('getLedger');
      return data?.ledger || [];
    },
    enabled: historyOpen && Boolean(customer?.id),
  });

  const signInMut = useMutation({
    mutationFn: async () => invokeCustomer('dailySignIn'),
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data.already_signed_in) {
        toast.info('You already signed in today. Come back tomorrow!');
      } else {
        toast.success('Daily sign-in bonus: +2 points!');
      }
      if (data.customer) {
        setCustomerState(data.customer);
        saveCustomer(data.customer);
      }
      qc.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: () => {
      toast.error('Failed to claim points. Try again.');
    },
  });

  const redeemMut = useMutation({
    mutationFn: ({ product }) => invokeCustomer('redeemProduct', { product_id: product.id }),
    onSuccess: (data, vars) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data.customer) {
        setCustomerState(data.customer);
        saveCustomer(data.customer);
      }
      setRedeemOpen(false);
      toast.success(`"${vars.product.name}" redeemed! ${data.points_used} points deducted. We'll contact you soon!`);
      const whatsappNumber = getSetting('whatsapp_number', '0096178714472');
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '').replace(/^0+/, '');
      const ambassadorInfo = customerRef.current?.ambassador_code ? `\nAmbassador Code: ${customerRef.current.ambassador_code}` : '';
      const waMsg = encodeURIComponent(
        `Redemption Alert!\n\nCustomer: ${customerRef.current.full_name}\nEmail: ${customerRef.current.email}\nMobile: ${customerRef.current.mobile}${ambassadorInfo}\n\nRequested Item: ${vars.product.name}\nPoints Used: ${data.points_used}\nRemaining Points: ${data.customer?.points ?? ''}\n\nPlease process this order!`
      );
      window.open(`https://wa.me/${cleanNumber}?text=${waMsg}`, '_blank');
      qc.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: () => toast.error('Redemption failed. Try again.'),
  });

  const openRedeem = async () => {
    const products = await store.products.list();
    const eligible = products.filter(p => {
      const cost = p.points_price > 0 ? p.points_price : pointsPriceFromUsd(p.price);
      return cost > 0 && p.in_stock && (customer.points || 0) >= cost;
    });
    setRedeemableProducts(eligible);
    setRedeemOpen(true);
  };

  if (!customer) return null;

  const alreadySignedIn = customer.server_today
    ? customer.last_signin_date === customer.server_today
    : false;
  const cardActive = isCardActive(customer);
  const cardExpiry = customer.card_expiry_date ? new Date(customer.card_expiry_date) : null;
  const daysLeft = customer.card_days_left ?? 0;
  const isExpiringSoon = Boolean(customer.card_expiring_soon);
  const isExpired = Boolean(customer.card_expired);
  const cardPurchaseDate = customer.card_purchase_date ? new Date(customer.card_purchase_date).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="hidden md:block"><Navbar /></div>
      <MobileHeader title="My Account" backTo="/" />
      <PullToRefresh onRefresh={refreshCustomer}>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-heading font-bold text-primary">
                {customer.full_name?.[0]?.toUpperCase()}
              </span>
            </div>
            <h1 className="font-heading font-bold text-2xl">{customer.full_name}</h1>
            <p className="text-muted-foreground">{customer.email}</p>
            {cardActive && (
              <Badge className="mt-2 bg-primary text-primary-foreground">
                <Star className="w-3 h-3 mr-1" /> WinWin Card Member
              </Badge>
            )}
            {isExpired && (
              <Badge className="mt-2 ml-2" variant="destructive">Expired</Badge>
            )}
            {cardActive && customer.is_ambassador && (
              <Badge className="mt-2 ml-2 bg-amber-500 text-white">
                <Trophy className="w-3 h-3 mr-1" /> Ambassador
              </Badge>
            )}
            {customer.is_ambassador && (
              <Badge className="mt-2 ml-2 bg-accent text-accent-foreground">
                <Wallet className="w-3 h-3 mr-1" /> ${(customer.wallet_balance || 0).toFixed(2)}
              </Badge>
            )}
          </div>

          {customer.must_reset_password && (
            <Card className="border-amber-400 bg-amber-50/50">
              <CardContent className="pt-6 text-sm">
                Please <Link to="/forgot-password" className="text-primary underline">set a new password</Link>. Your previous password was migrated from the old system.
              </CardContent>
            </Card>
          )}

          <ExpiryReminderBanner customer={customer} />

          {customer.is_ambassador && (
            <Card className="border-accent bg-accent/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-accent/10">
                    <Wallet className="w-7 h-7 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-bold text-accent">Ambassador Wallet</h3>
                    <p className="text-3xl font-bold mt-1">${(customer.wallet_balance || 0).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Current virtual balance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(cardActive || isExpired || customer.card_expiry_date) && (
            <Card className={isExpiringSoon ? 'border-amber-400 bg-amber-50/50' : isExpired ? 'border-destructive bg-destructive/5' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isExpiringSoon ? 'bg-amber-100' : isExpired ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                    {isExpiringSoon ? (
                      <Clock className="w-5 h-5 text-amber-600" />
                    ) : isExpired ? (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    {isExpired ? (
                      <>
                        <h3 className="font-heading font-semibold text-destructive">Card Expired</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your WinWin Card expired on {cardExpiry?.toLocaleDateString()}. 15% discount and free delivery are no longer active.
                        </p>
                      </>
                    ) : isExpiringSoon ? (
                      <>
                        <h3 className="font-heading font-semibold text-amber-700">Expiring in {daysLeft} day{daysLeft !== 1 ? 's' : ''}!</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your card expires on {cardExpiry?.toLocaleDateString()}. Renew now to keep your benefits active.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-heading font-semibold">Card Active</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Purchased: {cardPurchaseDate} · Expires: {cardExpiry?.toLocaleDateString()} · {daysLeft} days remaining
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {(isExpiringSoon || isExpired) && (
                  <button
                    onClick={() => { window.open(`https://wa.me/${getSetting('whatsapp_number', '0096178714472').replace(/[^0-9]/g, '').replace(/^0+/, '')}?text=${encodeURIComponent('Hi! I want to renew my WinWin Card.')}`, '_blank'); }}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" /> Renew My Card
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Star className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="font-heading font-bold text-3xl">{customer.points || 0}</div>
                <p className="text-sm text-muted-foreground">Points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="font-heading font-bold text-3xl">{customer.draw_entries || 0}</div>
                <p className="text-sm text-muted-foreground">Draw Entries</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Calendar className="w-5 h-5 text-primary" /> Daily Sign-In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Sign in once daily to earn 2 points!
              </p>
              <Button
                onClick={() => signInMut.mutate()}
                disabled={alreadySignedIn || signInMut.isPending}
                className="w-full"
              >
                <Gift className="w-4 h-4 mr-2" />
                {alreadySignedIn ? 'Already Signed In Today' : 'Claim Daily Points (+2)'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <ShoppingBag className="w-5 h-5 text-primary" /> Redeem Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Use your points to get items for free! You have <strong>{customer.points || 0} points</strong>. $1 = 100 points.
              </p>
              <Button onClick={openRedeem} className="w-full" variant="outline">
                <Gift className="w-4 h-4 mr-2" /> See Items I Can Redeem
              </Button>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4 mr-2" /> Points history
          </Button>

          <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Redeem Your Points</DialogTitle>
              </DialogHeader>
              {redeemableProducts.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  You don't have enough points for any item yet. Keep earning!
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {redeemableProducts.map(p => {
                    const cost = p.points_price > 0 ? p.points_price : pointsPriceFromUsd(p.price);
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        {p.image_url && (
                          <img
                            src={productImageSrc(p.image_url)}
                            alt={p.name}
                            className="w-14 h-14 object-cover rounded-md"
                            onError={(e) => productImageFallback(e, p.image_url)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                          <p className="text-xs text-muted-foreground">${p.price} · {cost} points</p>
                        </div>
                        <Button size="sm" disabled={redeemMut.isPending} onClick={() => redeemMut.mutate({ product: p })}>
                          Redeem
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Points history</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {ledger.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No ledger entries yet.</p>
                )}
                {ledger.map(row => (
                  <div key={row.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                    <div>
                      <p className="font-medium">{row.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{row.reason}</p>
                      <p className="text-xs text-muted-foreground">{row.created_date ? new Date(row.created_date).toLocaleString() : ''}</p>
                    </div>
                    <span className={row.points_amount >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {row.points_amount >= 0 ? '+' : ''}{row.points_amount}
                    </span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mobile</span>
                <span className="font-medium">{customer.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{customer.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WinWin Card</span>
                <span className="font-medium">
                  {cardActive ? (
                    <span className="text-accent">Active</span>
                  ) : isExpired ? (
                    <span className="text-destructive">Expired</span>
                  ) : 'Not Active'}
                </span>
              </div>
              {customer.card_purchase_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card Purchased</span>
                  <span className="font-medium">{new Date(customer.card_purchase_date).toLocaleDateString()}</span>
                </div>
              )}
              {customer.has_winwin_card && customer.card_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card Number</span>
                  <span className="font-medium">{customer.card_number}</span>
                </div>
              )}
              {customer.card_expiry_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card Expires</span>
                  <span className={`font-medium ${daysLeft <= 2 ? 'text-destructive' : ''}`}>
                    {new Date(customer.card_expiry_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              {customer.ambassador_code && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ambassador Code</span>
                  <span className="font-medium">{customer.ambassador_code}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              try { await invokeCustomer('logoutCustomer'); } catch (_e) { /* ignore */ }
              clearCustomer();
              navigate('/');
              window.location.reload();
            }}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>

          <Button
            variant="ghost"
            className="w-full text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete Account
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete your account? This action cannot be undone. All your points, entries, and data will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={async () => {
                    setDeleting(true);
                    clearCustomer();
                    navigate('/');
                    window.location.reload();
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PullToRefresh>
      <MobileBottomTab />
      <WhatsAppButton />
    </div>
  );
}
