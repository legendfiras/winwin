import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { invokePublic, setCustomer, setSessionToken } from '@/lib/customerAuth';
import { activationPath } from '@/lib/accountGuards';
import Navbar from '@/components/Navbar';
import CountryPhoneInput from '@/components/CountryPhoneInput';
import { countryOptions, formatInternational } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { LifeBuoy, KeyRound } from 'lucide-react';

// Old-platform customers activate their account here: confirm who they are
// (email, name, phone), then choose a password and are signed in right away.
export default function RecoverAccount() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('details');
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    first_name: '',
    last_name: '',
    country: 'Lebanon',
    phone: '',
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const payload = () => ({
    email: form.email.trim().toLowerCase(),
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    country: form.country,
    mobile: formatInternational(countryOptions().find((c) => c.name === form.country)?.dial || '', form.phone),
  });

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    if (form.phone.replace(/\D/g, '').length < 7) {
      setError('Enter your full phone number');
      return;
    }
    setLoading(true);
    try {
      const data = await invokePublic('checkAccountClaim', payload());
      if (data?.error) {
        setError(data.error);
        return;
      }
      setStep('password');
    } catch (err) {
      setError(err.message || 'Could not check your account');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await invokePublic('claimAccount', { ...payload(), password });
      if (data?.error) {
        setError(data.error);
        return;
      }
      setSessionToken(data.session_token);
      setCustomer(data.customer);
      toast.success('Your password is saved. Welcome to the new WinWin!');
      const next = activationPath(data.customer) || '/my-account';
      setTimeout(() => { window.location.href = next; }, 600);
    } catch (err) {
      setError(err.message || 'Could not save your password');
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
            {step === 'details' ? (
              <>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <LifeBuoy className="w-5 h-5 text-primary" /> Activate your account
                </CardTitle>
                <CardDescription>
                  Welcome to the new WinWin site. Confirm your details to set a new password. Your points and card stay on your account.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <KeyRound className="w-5 h-5 text-primary" /> Choose a new password
                </CardTitle>
                <CardDescription>
                  You will use this password with {form.email.trim().toLowerCase()} from now on.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            {step === 'details' ? (
              <form onSubmit={handleNext} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={form.first_name} onChange={update('first_name')} required autoComplete="given-name" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input value={form.last_name} onChange={update('last_name')} required autoComplete="family-name" />
                  </div>
                </div>
                <CountryPhoneInput
                  country={form.country}
                  localPhone={form.phone}
                  required
                  onChange={({ country, localPhone }) => setForm((prev) => ({ ...prev, country, phone: localPhone }))}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Checking...' : 'Next'}
                </Button>
                <p className="text-sm text-center">
                  <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setError(''); setStep('details'); }}>
                  Back
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
