import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useVerifyMagicLink } from '@/features/auth/use-auth';

/**
 * Where the emailed link lands: /auth/magic-link?token=...
 *
 * The token is single-use, so this must fire exactly once. React 18 StrictMode
 * runs effects twice in development, and without the ref guard the second run
 * consumes the token the first run just spent - producing a spurious "link
 * expired" on every successful sign-in.
 */
export function MagicLinkCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verify = useVerifyMagicLink();
  const [errorMessage, setErrorMessage] = useState('');
  const attempted = useRef(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setErrorMessage('That link is incomplete. Request a new one.');
      return;
    }

    verify
      .mutateAsync(token)
      .then(() => {
        void navigate('/', { replace: true });
      })
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'We could not sign you in. Request a new link.',
        );
      });
  }, [token, verify, navigate]);

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <AlertTriangle aria-hidden className="size-8 text-destructive" />
        <header className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight">That link didn't work</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </header>
        <Button asChild size="lg" className="w-full">
          <Link to="/magic-link">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Loader2 aria-hidden className="animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}