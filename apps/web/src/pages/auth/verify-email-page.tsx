import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useVerifyEmail } from '@/features/auth/use-auth';

type Status = 'working' | 'done' | 'failed';

/** Landing page for /auth/verify-email?token=... */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const verify = useVerifyEmail();
  const [status, setStatus] = useState<Status>('working');
  const [errorMessage, setErrorMessage] = useState('');
  const attempted = useRef(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus('failed');
      setErrorMessage('That link is incomplete.');
      return;
    }

    verify
      .mutateAsync(token)
      .then(() => setStatus('done'))
      .catch((error: unknown) => {
        setStatus('failed');
        setErrorMessage(
          error instanceof ApiError ? error.message : 'We could not confirm that address.',
        );
      });
  }, [token, verify]);

  if (status === 'working') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 aria-hidden className="animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Confirming your email…</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="space-y-6">
        <AlertTriangle aria-hidden className="size-8 text-destructive" />
        <header className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight">That link didn't work</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </header>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link to="/">Continue anyway</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CheckCircle2 aria-hidden className="size-8 text-primary" />
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Email confirmed</h1>
        <p className="text-muted-foreground">Thank you — that's everything.</p>
      </header>
      <Button asChild size="lg" className="w-full">
        <Link to="/">Continue</Link>
      </Button>
    </div>
  );
}