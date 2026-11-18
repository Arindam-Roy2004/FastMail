import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '@/lib/api';
import { GoogleCancelled, requestGoogleCode } from './google-identity';
import { GoogleSignInButton } from './google-sign-in-button';
import { useAuth } from './use-auth';

type LocationState = { from?: string } | null;

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const from = (location.state as LocationState)?.from ?? '/scheduled';

  if (auth.status === 'authenticated') return <Navigate to={from} replace />;

  const notice =
    error ??
    (auth.status === 'anonymous' && auth.reason === 'expired'
      ? { text: 'Your session expired. Sign in again.', tone: 'info' as const }
      : null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    try {
      const code = await requestGoogleCode();
      await auth.loginWithCode(code);
      navigate(from, { replace: true });
    } catch (err) {
      setError({
        text: errorMessage(err, 'Sign-in failed. Try again.'),
        tone: err instanceof GoogleCancelled ? 'info' : 'error',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-white px-4 py-12">
      <section className="w-full max-w-[496px] rounded-xl border border-line-strong bg-white px-6 pb-8 pt-14 sm:px-14">
        <h1 className="mb-8 text-center text-4xl font-bold tracking-tight text-[#1f1f1f]">Login</h1>
        <GoogleSignInButton onClick={signIn} loading={pending} />
        <p
          className={`mt-3 min-h-5 text-center text-[13px] ${notice?.tone === 'error' ? 'text-red' : 'text-muted'}`}
          role={notice ? 'alert' : undefined}
        >
          {notice?.text}
        </p>
      </section>
    </main>
  );
}
