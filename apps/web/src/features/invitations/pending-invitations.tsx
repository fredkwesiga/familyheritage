import { useState } from 'react';
import { Clock } from 'lucide-react';
import { ROLE_LABELS } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import { ApiError } from '@/lib/api-client';
import { usePendingInvitations, useRevokeInvitation } from './use-invitations';

/** Invitations sent and not yet taken up. */
export function PendingInvitations({ canManage }: { canManage: boolean }) {
  const { family } = useCurrentFamily();
  const { data: invitations } = usePendingInvitations(family.id, canManage);
  const revoke = useRevokeInvitation(family.id);
  const [error, setError] = useState('');

  const items = invitations ?? [];
  if (!canManage || items.length === 0) return null;

  const cancel = async (id: string, email: string) => {
    if (!window.confirm(`Cancel the invitation to ${email}?`)) return;
    setError('');
    try {
      await revoke.mutateAsync(id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not cancel it.');
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg tracking-tight">Waiting to be accepted</h2>

      <FormMessage>{error}</FormMessage>

      <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
        {items.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-3 p-4">
            <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{invitation.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[invitation.role].label}
                {invitation.invitedByName && ` · invited by ${invitation.invitedByName}`}
                {/* An expired invitation is still shown, because "why has
                    nobody joined?" is answered by seeing it lapsed. */}
                {invitation.isExpired && ' · expired'}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={revoke.isPending}
              onClick={() => void cancel(invitation.id, invitation.email)}
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}