import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailX } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { unsubscribeMarketing } from '@/lib/marketing';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    const token = params.get('token') || '';
    if (!token) {
      setState({ loading: false, error: 'This unsubscribe link is invalid.' });
      return;
    }
    unsubscribeMarketing(token)
      .then(() => setState({ loading: false, error: '' }))
      .catch((error) => setState({ loading: false, error: error.message || 'Unable to unsubscribe.' }));
  }, [params]);

  const success = !state.loading && !state.error;
  return (
    <AuthLayout
      icon={success ? CheckCircle2 : MailX}
      title={state.loading ? 'Updating your preference...' : success ? 'You are unsubscribed' : 'Link not accepted'}
      footer={null}
      subtitle={state.loading
        ? 'Please wait a moment.'
        : success
          ? 'You will no longer receive WinWin points, rewards, or new-item email updates. Password reset and account-security emails are not affected.'
          : state.error}
    >
      {!state.loading && (
        <Link
          to="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to WinWin
        </Link>
      )}
    </AuthLayout>
  );
}
