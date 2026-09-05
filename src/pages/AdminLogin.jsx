import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAdmin, isAdmin, setAdminSessionToken } from '@/lib/customerAuth';
import { invokePublic } from '@/lib/customerAuth';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAdmin()) navigate('/admin');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await invokePublic('adminLogin', { password: password.trim() });
      if (data?.error || !data?.admin_session_token) {
        toast.error(data?.error || 'Incorrect password. Try 1234 if you have not changed it yet.');
        return;
      }
      setAdminSessionToken(data.admin_session_token);
      setAdmin(true);
      toast.success('Welcome, Admin!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-heading">Admin Access</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Starter password is <span className="font-mono">1234</span> until you change it in Settings.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Checking...' : 'Enter Admin Panel'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
