import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { invokePublic } from '@/lib/customerAuth';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LifeBuoy } from 'lucide-react';
import CountryPhoneInput from '@/components/CountryPhoneInput';
import { countryOptions, formatInternational } from '@/lib/countries';

export default function RecoverAccount() {
  const [form, setForm] = useState({
    requested_email: '',
    country: 'Lebanon',
    phone: '',
    legacy_user_id: '',
    card_number: '',
    full_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await invokePublic('submitAccountRecovery', {
        ...form,
        phone: formatInternational(countryOptions().find((c) => c.name === form.country)?.dial || '', form.phone),
        requested_email: form.requested_email.toLowerCase(),
        app_origin: window.location.origin,
      });
      if (data?.error) {
        setError(data.error);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not submit recovery request');
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
              <LifeBuoy className="w-5 h-5 text-primary" /> Recover account
            </CardTitle>
            <CardDescription>
              Enter the email you want to use and your phone, customer ID, or loyalty card number. If the email is already on your account, we will send you a password link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {result.message || (result.auto_approved
                    ? 'We found your account. Check your email for a reset link.'
                    : 'Your recovery request was submitted. An admin will review it.')}
                </p>
                <Link to="/auth" className="text-primary hover:underline text-sm">Back to sign in</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
                )}
                <div>
                  <Label>Email address</Label>
                  <Input type="email" value={form.requested_email} onChange={update('requested_email')} required autoComplete="email" />
                </div>
                <CountryPhoneInput
                  country={form.country}
                  localPhone={form.phone}
                  onChange={({ country, localPhone }) => setForm((prev) => ({ ...prev, country, phone: localPhone }))}
                />
                <div>
                  <Label>Customer / legacy ID</Label>
                  <Input value={form.legacy_user_id} onChange={update('legacy_user_id')} />
                </div>
                <div>
                  <Label>Loyalty / card number</Label>
                  <Input value={form.card_number} onChange={update('card_number')} />
                </div>
                <div>
                  <Label>Name <span className="text-muted-foreground text-xs">(optional, not used alone)</span></Label>
                  <Input value={form.full_name} onChange={update('full_name')} autoComplete="name" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit recovery request'}
                </Button>
                <p className="text-sm text-center">
                  <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
