import { useState } from 'react';
import { Loader2, MailCheck, Send } from 'lucide-react';
import {
  emailSchema,
  INVITE_ROLE_HINTS,
  ROLE_LABELS,
  type InvitableRole,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentFamily } from '@/features/families/family-context';
import { ApiError } from '@/lib/api-client';
import { useCreateInvitation } from './use-invitations';

const ROLES: InvitableRole[] = ['CONTRIBUTOR', 'ADMIN', 'VIEWER'];

export function InviteForm() {
  const { family } = useCurrentFamily();
  const createInvitation = useCreateInvitation(family.id);

  const [email, setEmail] = useState('');
  // Contributor first and by default. Most relatives are there to add what they
  // remember, and a Viewer default would quietly make the product read-only for
  // everyone but the person who set it up.
  const [role, setRole] = useState<InvitableRole>('CONTRIBUTOR');
  const [message, setMessage] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError('Enter a valid email address.');

    try {
      await createInvitation.mutateAsync({
        email: parsed.data,
        role,
        message: message.trim() || undefined,
      });
      setSentTo(parsed.data);
      setEmail('');
      setMessage('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send that invitation.');
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="font-serif text-xl tracking-tight">Invite someone</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          A family record kept by one person stays small. The relatives who remember the most are
          usually not the ones who set it up.
        </p>
      </div>

      <FormMessage>{error}</FormMessage>

      {sentTo && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <MailCheck aria-hidden className="size-4" />
          Sent to {sentTo}. The link works once and lasts a week.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Their email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="relative@example.com"
          />
        </FormField>

        <FormField label="What they can do" htmlFor="invite-role" hint={INVITE_ROLE_HINTS[role]}>
          <Select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as InvitableRole)}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value].label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="A note, if you like"
        htmlFor="invite-message"
        hint="Included in the email. A line of context helps more than you'd think."
      >
        <Textarea
          id="invite-message"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Thought you'd want to add what you remember about Grandpa."
        />
      </FormField>

      <Button onClick={() => void submit()} disabled={createInvitation.isPending || !email}>
        {createInvitation.isPending ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <Send aria-hidden />
        )}
        Send invitation
      </Button>
    </section>
  );
}