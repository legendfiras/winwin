import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCustomer, invokeCustomer, setCustomer } from '@/lib/customerAuth';
import { countryOptions, formatInternational, matchCountry, parseLocalPhone } from '@/lib/countries';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';

function isJunkAmbassador(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return false;
  return c === 'base44.app' || c === 'base44' || c === '2011' || c === '1234' || c === 'admin' || /^[0-9]{1,4}$/.test(c);
}

function buildInitialForm(customer) {
  const matched = matchCountry(customer?.country);
  const country = matched?.name || '';
  const dial = matched?.dial || '';
  return {
    country,
    first_name: String(customer?.first_name || '').trim(),
    last_name: String(customer?.last_name || '').trim(),
    email: String(customer?.email || '').trim(),
    local_phone: parseLocalPhone(customer?.mobile, dial),
    ambassador_code: isJunkAmbassador(customer?.ambassador_code) ? '' : String(customer?.ambassador_code || '').trim(),
  };
}

const PREVIEW_CUSTOMER = {
  first_name: 'Nada',
  last_name: 'Chehade',
  mobile: '76542311',
  email: 'you@email.com',
  country: 'Lebanon',
  ambassador_code: '',
  points: 2450,
  card_number: '35',
  profile_review_required: true,
};

const SELECT_CLASS =
  'flex h-9 w-full rounded-[10px] border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function ReviewProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const existing = isPreview ? PREVIEW_CUSTOMER : getCustomer();
  const [form, setForm] = useState(() => buildInitialForm(existing));
  const [loading, setLoading] = useState(false);
  const countries = useMemo(() => countryOptions(), []);

  useEffect(() => {
    if (isPreview) return;
    const current = getCustomer();
    if (!current) {
      navigate('/auth');
      return;
    }
    if (!current.profile_review_required) {
      navigate('/my-account');
    }
  }, [navigate, isPreview]);

  const selected = countries.find((c) => c.name === form.country) || null;
  const dial = selected?.dial || '';
  const fullPhone = formatInternational(dial, form.local_phone);

  const issues = useMemo(() => {
    const list = [];
    if (!form.country) list.push('Choose your country.');
    if (form.country && String(form.local_phone || '').replace(/\D/g, '').length < 7) {
      list.push('Enter a complete phone number after the country code.');
    }
    if (!String(form.first_name || '').trim()) list.push('First name is required.');
    if (!String(form.last_name || '').trim()) list.push('Last name is required.');
    if (!String(form.email || '').trim()) list.push('Email is required.');
    return list;
  }, [form]);

  if (!existing) return null;

  const onCountryChange = (name) => {
    const next = countries.find((c) => c.name === name);
    const nextDial = next?.dial || '';
    setForm((prev) => ({
      ...prev,
      country: name,
      local_phone: parseLocalPhone(prev.local_phone, nextDial),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.country) {
      toast.error('Country is required');
      return;
    }
    if (String(form.local_phone || '').replace(/\D/g, '').length < 7) {
      toast.error('Enter a complete phone number');
      return;
    }
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (isPreview) {
      toast.message('Preview only — nothing was saved.');
      return;
    }
    setLoading(true);
    try {
      const data = await invokeCustomer('reviewProfile', {
        first_name: form.first_name,
        last_name: form.last_name,
        mobile: fullPhone,
        email: form.email,
        country: form.country,
        ambassador_code: form.ambassador_code,
        app_origin: window.location.origin,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data.customer) setCustomer(data.customer);
      toast.success(data.email_changed
        ? 'Saved. Check your inbox to verify the new email.'
        : 'Saved');
      navigate('/my-account');
    } catch (err) {
      toast.error(err.message || 'Could not save your profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <ClipboardCheck className="w-5 h-5 text-primary" /> Your details
            </CardTitle>
            <CardDescription>
              Fill in any missing information, then submit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {issues.length > 0 ? (
              <div className="mb-4 rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-3 space-y-1">
                {issues.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>Country</Label>
                <select
                  className={SELECT_CLASS}
                  value={form.country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  required
                  autoComplete="country-name"
                >
                  <option value="" disabled>Select your country</option>
                  {countries.map((c) => (
                    <option key={c.iso} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {form.country ? (
                <div>
                  <Label>Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      className="w-[5.5rem] shrink-0 text-center px-2"
                      value={dial ? `+${dial}` : ''}
                      readOnly
                      tabIndex={-1}
                      aria-label="Country calling code"
                    />
                    <Input
                      value={form.local_phone}
                      onChange={(e) => setForm({ ...form, local_phone: e.target.value.replace(/[^\d]/g, '') })}
                      required
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder={dial === '961' ? '3XXXXXXX' : 'Phone number'}
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Label>Ambassador Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={form.ambassador_code}
                  onChange={(e) => setForm({ ...form, ambassador_code: e.target.value })}
                  placeholder="Leave blank if you do not have one"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || issues.length > 0}>
                {loading ? 'Saving...' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
