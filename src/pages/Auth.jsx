import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { invokePublic, setCustomer, setSessionToken } from '@/lib/customerAuth';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UserPlus, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Auth() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignInForm />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await invokePublic('loginCustomer', {
        email: email.toLowerCase(),
        password,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSessionToken(data.session_token);
      setCustomer(data.customer);
      toast.success(data.customer?.must_reset_password
        ? 'Welcome back. Please set a new password from Forgot Password when you can.'
        : 'Welcome back!');
      setTimeout(() => { window.location.href = '/'; }, 600);
    } catch (err) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <LogIn className="w-5 h-5 text-primary" /> Sign In
        </CardTitle>
        <CardDescription>Sign in with the email on your account. Daily points are claimed from My Account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignUpForm() {
  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', country: '', password: '', confirm: '', ambassador_code: '' });
  const [loading, setLoading] = useState(false);
  const [waNumber, setWaNumber] = useState('');

  React.useEffect(() => {
    base44.entities.AppSettings.list().then(settingsList => {
      const waSetting = settingsList.find(s => s.setting_key === 'whatsapp_number');
      const num = (waSetting?.setting_value || '0096178714472').replace(/[^0-9]/g, '').replace(/^0+/, '');
      setWaNumber(num);
    });
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const data = await invokePublic('registerCustomer', {
        full_name: form.full_name,
        email: form.email.toLowerCase(),
        mobile: form.mobile,
        country: form.country,
        password: form.password,
        ambassador_code: form.ambassador_code,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const ambassadorInfo = form.ambassador_code ? `\nAmbassador Code: ${form.ambassador_code}` : '';
      const waMsg = encodeURIComponent(`🆕 New WinWin Customer!\n\nName: ${form.full_name}\nEmail: ${form.email}\nMobile: ${form.mobile}\nCountry: ${form.country}${ambassadorInfo}`);
      const num = waNumber || '96178714472';
      window.open(`https://wa.me/${num}?text=${waMsg}`, '_blank');

      setSessionToken(data.session_token);
      setCustomer(data.customer);
      toast.success('Welcome to WinWin! You received 10 bonus points!');
      setTimeout(() => { window.location.href = '/'; }, 1000);
    } catch (err) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <UserPlus className="w-5 h-5 text-primary" /> Sign Up
        </CardTitle>
        <CardDescription>Create an account and get 10 free points!</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required autoComplete="email" />
          </div>
          <div>
            <Label>Mobile Number</Label>
            <Input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} required placeholder="+961..." />
          </div>
          <div>
            <Label>Country</Label>
            <Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} required autoComplete="new-password" />
          </div>
          <div>
            <Label>Ambassador Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={form.ambassador_code} onChange={e => setForm({...form, ambassador_code: e.target.value})} placeholder="Enter code if you have one" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up & Get 10 Points'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
