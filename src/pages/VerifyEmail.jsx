import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { invokePublic } from '@/lib/customerAuth';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [message, setMessage] = useState('Verifying your email...');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage('This verification link is missing or invalid.');
      return;
    }
    invokePublic('verifyEmail', { token }).then((data) => {
      if (data?.error) {
        setMessage(data.error);
        return;
      }
      setOk(true);
      setMessage('Your email is verified. You can continue using your account.');
    }).catch(() => {
      setMessage('Could not verify this email. Try again later.');
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Mail className="w-5 h-5 text-primary" /> Email verification
            </CardTitle>
            <CardDescription>{ok ? 'Done' : 'One moment'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link to="/my-account" className="text-primary hover:underline text-sm">Go to My Account</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
