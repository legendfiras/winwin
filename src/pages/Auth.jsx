import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { invokePublic, setCustomer, setSessionToken } from '@/lib/customerAuth';
import { activationPath } from '@/lib/accountGuards';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { store } from '@/api/store';
import { toast } from 'sonner';
import { UserPlus, LogIn, KeyRound } from 'lucide-react';

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
  const [migratedEmail, setMigratedEmail] = useState('');
  const [setupSent, setSetupSent] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await invokePublic('loginCustomer', {
        email: email.toLowerCase(),
        password,
      });
      if (data?.code === 'MIGRATED_SETUP_REQUIRED') {
        setMigratedEmail(email.toLowerCase());
        setSetupSent(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSessionToken(data.session_token);
      setCustomer(data.customer);
      toast.success('Welcome back!');
      const next = activationPath(data.customer) || '/';
      setTimeout(() => { window.location.href = next; }, 600);
    } catch (err) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const sendSetup = async () => {
    setSetupLoading(true);
    try {
      await invokePublic('requestPasswordReset', {
        email: migratedEmail,
        app_origin: window.location.origin,
      });
      setSetupSent(true);
    } catch {
      setSetupSent(true);
    } finally {
      setSetupLoading(false);
    }
  };

  if (migratedEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <KeyRound className="w-5 h-5 text-primary" /> Your account has been migrated
          </CardTitle>
          <CardDescription>
            Set up a new password to continue. We did not copy passwords from the old platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupSent ? (
            <p className="text-sm text-muted-foreground">
              If this email is on a migrated account, you will receive password setup instructions shortly.
              The link expires in 1 hour and can be used once.
            </p>
          ) : (
            <Button type="button" className="w-full" onClick={sendSetup} disabled={setupLoading}>
              {setupLoading ? 'Sending...' : 'Set Up My Password'}
            </Button>
          )}
          <p className="text-sm text-center">
            <Link to="/recover-account" className="text-primary hover:underline">Can&apos;t access your old email?</Link>
          </p>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setMigratedEmail('')}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

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
          <p className="text-sm text-center text-muted-foreground">
            Migrated from the old app?{' '}
            <Link to="/recover-account" className="text-primary hover:underline">Recover migrated account</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SignUpForm() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    confirm: '',
    ambassador_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [waNumber, setWaNumber] = useState('');

  React.useEffect(() => {
    store.settings.list().then((settingsList) => {
      const list = Array.isArray(settingsList) ? settingsList : [];
      const waSetting = list.find((s) => s.setting_key === 'whatsapp_number');
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
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email.toLowerCase(),
        mobile: form.mobile,
        password: form.password,
        ambassador_code: form.ambassador_code,
        app_origin: window.location.origin,
      });
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSessionToken(data.session_token);
      setCustomer(data.customer);
      const ambassadorInfo = form.ambassador_code ? `\nAmbassador Code: ${form.ambassador_code}` : '';
      const waMsg = encodeURIComponent(`🆕 New WinWin Customer!\n\nName: ${form.first_name} ${form.last_name}\nEmail: ${form.email}\nMobile: ${form.mobile}${ambassadorInfo}`);
      window.open(`https://wa.me/${waNumber || '96178714472'}?text=${waMsg}`, '_blank');
      toast.success(data.points_awarded
        ? `Welcome to WinWin! You received ${data.points_awarded} bonus points.`
        : 'Welcome to WinWin!');
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
        <CardDescription>Create an account and get 10 free points. No delivery address needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required autoComplete="given-name" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required autoComplete="family-name" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} required placeholder="+961..." autoComplete="tel" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
          </div>
          <div>
            <Label>Ambassador Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={form.ambassador_code} onChange={e => setForm({ ...form, ambassador_code: e.target.value })} placeholder="Enter code if you have one" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up & Get 10 Points'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
