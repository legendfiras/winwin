import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomer, invokeCustomer } from '@/lib/customerAuth';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';

export default function ReviewProfile() {
  const navigate = useNavigate();
  const existing = getCustomer();
  const [form, setForm] = useState({
    first_name: existing?.first_name || '',
    last_name: existing?.last_name || '',
    mobile: existing?.mobile || '',
    email: existing?.email || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const current = getCustomer();
    if (!current) {
      navigate('/auth');
      return;
    }
    if (!current.profile_review_required) {
      navigate('/my-account');
    }
  }, [navigate]);

  if (!existing) return null;

  const missingPhone = !String(form.mobile || '').trim();

  const save = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (missingPhone) {
      toast.error('Phone number is required');
      return;
    }
    setLoading(true);
    try {
      const data = await invokeCustomer('reviewProfile', {
        first_name: form.first_name,
        last_name: form.last_name,
        mobile: form.mobile,
        email: form.email,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Your information was saved');
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
              <ClipboardCheck className="w-5 h-5 text-primary" /> Review Your Information
            </CardTitle>
            <CardDescription>
              Confirm the details imported from your previous account. Delivery address is not needed here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>First Name</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label>Phone Number {missingPhone ? <span className="text-destructive">Required</span> : null}</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  required
                  placeholder={missingPhone ? 'Required' : ''}
                  autoComplete="tel"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Everything Looks Correct'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
