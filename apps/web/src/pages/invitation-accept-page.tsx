import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Loader2, Users } from 'lucide-react';
import { ROLE_LABELS } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useLogout, useSession } from '@/features/auth/use-auth';
import {
  useAcceptInvitation,
  useInvitationPreview,
} from '@/features/invitations/use-invitations';
import { ApiError } from '@/lib/api-client';

/**
 * Where an invitation link lands.
 *
 * Reachable signed in or signed out, because the person arriving has usually
 * never used this product before. That is the whole design problem here: an
 * invitation that opens on a login wall, with no indication of what is behind
 * it or who sent it, gets closed. So the family's name and the person who
 * invited them come first, and signing in is framed as the step that completes
 * something already begun rather than a gate in front of it.
 */
export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const { user, isPending: sessionPending } = useSession();
  const { data: preview, isPending: previewPending } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const logout = useLogout();
  const [error, setError] = useState('');

  if (previewPending || sessionPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || !preview || preview.status === 'NOT_FOUND') {
    return (
      <Shell icon={<AlertTriangle aria-hidden className="size-7 text-muted-foreground" />}>
        <h1 className="font-serif text-2xl tracking-tight">This invitation isn't valid</h1>
        <p className="text-muted-foreground text-pretty">
          It may have been cancelled, or the link may be incomplete. Ask whoever invited you to
          send another.
        </p>
      </Shell>
    );
  }

  if (preview.status === 'EXPIRED') {
    return (
      <Shell icon={<AlertTriangle aria-hidden className="size-7 text-muted-foreground" />}>
        <h1 className="font-serif text-2xl tracking-tight">This invitation has expired</h1>
        <p className="text-muted-foreground text-pretty">
          Invitations to {preview.familyName} last a week. Ask
          {preview.invitedByName ? ` ${preview.invitedByName}` : ' whoever invited you'} for a new
          one.
        </p>
      </Shell>
    );
  }

  if (preview.status === 'ALREADY_ACCEPTED') {
    return (
      <Shell icon={<Check aria-hidden className="size-7 text-primary" />}>
        <h1 className="font-serif text-2xl tracking-tight">This one has already been used</h1>
        <p className="text-muted-foreground">
          If it was you, sign in and {preview.familyName} will be there.
        </p>
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </Shell>
    );
  }

  const invitedBy = preview.invitedByName ?? 'Someone';
  const intro = (
    <>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-balance">
        {invitedBy} has invited you to {preview.familyName}
      </h1>
      <p className="text-muted-foreground text-pretty">
        A record of who everyone is, how they are related, and the stories worth keeping. You are
        being added as {ROLE_LABELS[preview.role].label.toLowerCase()} —{' '}
        {ROLE_LABELS[preview.role].description.toLowerCase()}
      </p>
    </>
  );

  // --- Not signed in -------------------------------------------------------

  if (!user) {
    // The email is carried into registration so the address matches without the
    // person having to notice that it must.
    const next = `/invitations/accept?token=${encodeURIComponent(token)}`;

    return (
      <Shell icon={<Users aria-hidden className="size-7 text-accent" />}>
        {intro}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to={`/register?email=${encodeURIComponent(preview.email)}`} state={{ from: next }}>
              Create an account
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login" state={{ from: next }}>
              I already have one
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Use {preview.email} — the address this was sent to.
        </p>
      </Shell>
    );
  }

  // --- Signed in as the wrong person --------------------------------------

  if (user.email.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <Shell icon={<AlertTriangle aria-hidden className="size-7 text-muted-foreground" />}>
        <h1 className="font-serif text-2xl tracking-tight">This was sent to someone else</h1>
        <p className="text-muted-foreground text-pretty">
          The invitation is for {preview.email}, and you are signed in as {user.email}. An
          invitation only works for the address it was sent to — otherwise a forwarded link would
          let anyone into a family's private records.
        </p>
        <Button
          variant="outline"
          disabled={logout.isPending}
          onClick={() => void logout.mutateAsync()}
        >
          Sign out and use {preview.email}
        </Button>
      </Shell>
    );
  }

  // --- Signed in, ready to join -------------------------------------------

  const accept = async () => {
    setError('');
    try {
      const result = await acceptInvitation.mutateAsync(token);
      void navigate(`/f/${result.familyId}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not join the family.');
    }
  };

  return (
    <Shell icon={<Users aria-hidden className="size-7 text-accent" />}>
      {intro}
      <FormMessage>{error}</FormMessage>
      <Button size="lg" onClick={() => void accept()} disabled={acceptInvitation.isPending}>
        {acceptInvitation.isPending && <Loader2 aria-hidden className="animate-spin" />}
        Join {preview.familyName}
      </Button>
    </Shell>
  );
}

function Shell({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto max-w-lg space-y-5 text-center">
        <div className="flex justify-center">{icon}</div>
        {children}
      </div>
    </div>
  );
}