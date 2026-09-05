import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { getCustomer, getSessionToken, isCardActive, invokeCustomer, invokePublic } from '@/lib/customerAuth';
import { cartTotals, formatMoney, orderDisplayId } from '@/lib/pricing';
import { cartWhatsAppMessage, whatsappUrl } from '@/lib/whatsapp';
import { useSettings } from '@/lib/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CONTACT_KEY = 'winwin_checkout_contact';

function emptyAddress() {
  return { governorate: '', area: '', street: '', building: '', floor: '', instructions: '', label: 'Home' };
}

function readContact() {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function CheckoutDialog() {
  const { items, clear, checkoutOpen, setCheckoutOpen } = useCart();
  const { getSetting } = useSettings();
  const waNumber = getSetting('whatsapp_number', '0096181629538');
  const customer = getCustomer();
  const hasCard = isCardActive(customer);
  const totals = cartTotals(items, false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(emptyAddress());
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!checkoutOpen) return;
    const saved = readContact();
    setName(customer?.full_name || saved.name || '');
    setPhone(customer?.mobile || saved.phone || '');
    setEmail(customer?.email || saved.email || '');
    if (saved.address) setAddress({ ...emptyAddress(), ...saved.address });
    if (!getSessionToken()) {
      setAddresses([]);
      return;
    }
    invokeCustomer('listAddresses').then((data) => {
      const list = data?.addresses || [];
      setAddresses(list);
      const def = list.find((row) => row.is_default) || list[0];
      if (def) {
        setSelectedId(def.id);
        setAddress({
          governorate: def.governorate || '',
          area: def.area || '',
          street: def.street || '',
          building: def.building || '',
          floor: def.floor || '',
          instructions: def.instructions || '',
          label: def.label || 'Home',
        });
        if (def.full_name) setName(def.full_name);
        if (def.phone) setPhone(def.phone);
      }
    }).catch(() => {});
  }, [checkoutOpen, customer?.full_name, customer?.mobile, customer?.email]);

  const applySaved = (id) => {
    setSelectedId(id);
    if (id === 'new') {
      setAddress(emptyAddress());
      return;
    }
    const def = addresses.find((row) => row.id === id);
    if (!def) return;
    setAddress({
      governorate: def.governorate || '',
      area: def.area || '',
      street: def.street || '',
      building: def.building || '',
      floor: def.floor || '',
      instructions: def.instructions || '',
      label: def.label || 'Home',
    });
    if (def.full_name) setName(def.full_name);
    if (def.phone) setPhone(def.phone);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!items.length) return;
    setBusy(true);
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, phone, email, address }));
      const data = await invokePublic('submitCheckout', {
        items: items.map((item) => ({ id: item.id, qty: item.qty })),
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        ambassador_code: customer?.ambassador_code || '',
        member_price_requested: hasCard,
        session_token: getSessionToken() || '',
        save_address: Boolean(getSessionToken() && saveAddress),
        address: {
          ...address,
          id: selectedId && selectedId !== 'new' ? selectedId : '',
          full_name: name,
          phone,
        },
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const tx = data.transaction;
      const message = cartWhatsAppMessage(tx.items || items, {
        subtotal: tx.amount_usd,
        total: tx.amount_usd,
        orderId: tx.id,
        customerName: name,
        ambassadorCode: customer?.ambassador_code,
        hasCard: false,
        delivery: tx.delivery || address,
      });
      window.open(whatsappUrl(waNumber, message), '_blank');
      clear();
      setCheckoutOpen(false);
      toast.success(`Order ${orderDisplayId(tx.id)} sent for approval`);
    } catch (err) {
      toast.error(err.message || 'Could not submit the order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Checkout</DialogTitle>
          <DialogDescription>
            Enter delivery details. We will save this order for admin approval and open WhatsApp to confirm it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-[10px] bg-secondary px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span>{items.length} product{items.length === 1 ? '' : 's'}</span>
              <span className="font-semibold tabular-nums">{formatMoney(totals.total)}</span>
            </div>
            {hasCard ? (
              <p className="mt-1 text-xs text-muted-foreground">
                WinWin member price will be confirmed when the order is approved.
              </p>
            ) : null}
          </div>
          {addresses.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="checkout-saved">Saved address</Label>
              <select
                id="checkout-saved"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedId}
                onChange={(e) => applySaved(e.target.value)}
              >
                {addresses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label || 'Address'} — {row.street}
                  </option>
                ))}
                <option value="new">Add another address</option>
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="checkout-name">Full Name</Label>
            <Input id="checkout-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-phone">Phone</Label>
            <Input id="checkout-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" inputMode="tel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-email">Email (optional)</Label>
            <Input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-gov">Governorate / Area</Label>
            <Input id="checkout-gov" value={address.governorate} onChange={(e) => setAddress({ ...address, governorate: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-area">Neighborhood (optional)</Label>
            <Input id="checkout-area" value={address.area} onChange={(e) => setAddress({ ...address, area: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-street">Street</Label>
            <Input id="checkout-street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="checkout-building">Building</Label>
              <Input id="checkout-building" value={address.building} onChange={(e) => setAddress({ ...address, building: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-floor">Floor</Label>
              <Input id="checkout-floor" value={address.floor} onChange={(e) => setAddress({ ...address, floor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Delivery instructions</Label>
            <Textarea id="checkout-notes" value={address.instructions} onChange={(e) => setAddress({ ...address, instructions: e.target.value })} rows={2} />
          </div>
          {getSessionToken() ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
              />
              Save this address for future orders
            </label>
          ) : null}
          <Button type="submit" className="h-12 w-full rounded-[10px] bg-green-700 text-white hover:bg-green-800" disabled={busy || items.length === 0}>
            <MessageCircle className="h-5 w-5" />
            {busy ? 'Submitting...' : 'Submit order'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
