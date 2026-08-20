import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Permission, ROLE_LABELS, type FamilyAccessEntry, type FamilyRoleValue } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { useCurrentFamily } from '@/features/families/family-context';
import { useChangeRole, useFamilyAccess, useRevokeAccess } from '@/features/families/use-families';
import { ApiError } from '@/lib/api-client';
import { InviteForm } from '@/features/invitations/invite-form';
import { PendingInvitations } from '@/features/invitations/pending-invitations';

const ASSIGNABLE: Exclude<FamilyRoleValue, 'OWNER'>[] = ['ADMIN', 'CONTRIBUTOR', 'VIEWER'];

export function FamilyAccessPage() {
  const { family, can } = useCurrentFamily();
  const { data: access, isPending } = useFamilyAccess(family.id);
  const changeRole = useChangeRole(family.id);
  const revokeAccess = useRevokeAccess(family.id);
  const [error, setError] = useState('');

  const canManage = can(Permission.ACCESS_CHANGE_ROLE);

  const handleRoleChange = async (userId: string, role: FamilyRoleValue) => {
    setError('');
    if (role === 'OWNER') return;
    try {
      await changeRole.mutateAsync({ userId, role });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change that role.');
    }
  };

  const handleRevoke = async (entry: FamilyAccessEntry) => {
    setError('');
    const name = entry.name ?? entry.email;
    if (!window.confirm(`Remove ${name}'s access to ${family.name}?`)) return;
    try {
      await revokeAccess.mutateAsync(entry.userId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove that person.');
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">People</h1>
        <p className="text-muted-foreground text-pretty">
          Everyone who can sign in and see this family. These are accounts, not relatives in the
          tree — a person can appear in the tree without ever having an account.
        </p>
      </header>

      <FormMessage>{error}</FormMessage>

      {can(Permission.ACCESS_INVITE) && <InviteForm />}

      <PendingInvitations canManage={can(Permission.ACCESS_INVITE)} />

      <h2 className="font-serif text-lg tracking-tight">People with access</h2>

      <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
        {access?.map((entry) => (
          <li key={entry.userId} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {entry.name ?? entry.email}
                {entry.isYou && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}
              </p>
              <p className="truncate text-sm text-muted-foreground">{entry.email}</p>
            </div>

            {/* The owner's role is fixed here on purpose: it moves only through
                the transfer flow, which is a separate, confirmed action. */}
            {canManage && !entry.isYou && entry.role !== 'OWNER' ? (
              <div className="w-40">
                <Select
                  aria-label={`Role for ${entry.name ?? entry.email}`}
                  value={entry.role}
                  disabled={changeRole.isPending}
                  onChange={(event) =>
                    void handleRoleChange(entry.userId, event.target.value as FamilyRoleValue)
                  }
                >
                  {ASSIGNABLE.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role].label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <span className="w-40 text-sm uppercase tracking-wider text-muted-foreground">
                {ROLE_LABELS[entry.role].label}
              </span>
            )}

            {can(Permission.ACCESS_REVOKE) && !entry.isYou && entry.role !== 'OWNER' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revokeAccess.isPending}
                onClick={() => void handleRevoke(entry)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="font-serif text-lg tracking-tight">What each role can do</h2>
        <dl className="space-y-2 text-sm">
          {(['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'] as FamilyRoleValue[]).map((role) => (
            <div key={role} className="flex gap-3">
              <dt className="w-28 shrink-0 text-muted-foreground">{ROLE_LABELS[role].label}</dt>
              <dd className="text-muted-foreground">{ROLE_LABELS[role].description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}