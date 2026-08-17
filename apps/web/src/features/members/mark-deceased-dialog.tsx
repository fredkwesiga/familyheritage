import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EMPTY_DATE, normalizeDate, type ApproximateDate, type Member } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useMarkDeceased } from './use-members';
import { ApproximateDateInput } from './approximate-date-input';

/**
 * Uses the native <dialog> element rather than a Radix modal.
 *
 * showModal() gives focus trapping, Escape-to-close, inert background and the
 * top layer for free - all the things a hand-rolled modal gets wrong - with no
 * extra dependency.
 */
export function MarkDeceasedDialog({
  member,
  familyId,
  open,
  onClose,
}: {
  member: Member;
  familyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const markDeceased = useMarkDeceased(familyId, member.id);

  const [death, setDeath] = useState<ApproximateDate>(EMPTY_DATE);
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = async () => {
    setError('');
    try {
      await markDeceased.mutateAsync({
        death: normalizeDate(death),
        deathPlace: place.trim() || null,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground backdrop:bg-foreground/20 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-6 p-6">
        <header className="space-y-2">
          <h2 className="font-serif text-2xl tracking-tight">
            Record that {member.displayName} has passed away
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing is deleted. Their photograph, biography and stories stay exactly as they are,
            and only how they appear in the tree changes.
          </p>
        </header>

        <FormMessage>{error}</FormMessage>

        {/* No date required. Families frequently know that someone died without
            knowing when, and demanding a date invites an invented one. */}
        <ApproximateDateInput
          label="When, if you know"
          idPrefix="death"
          value={death}
          onChange={setDeath}
        />

        <FormField label="Where, if you know" htmlFor="deathPlace">
          <Input
            id="deathPlace"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="Kampala, Uganda"
          />
        </FormField>

        <div className="flex items-center gap-3 border-t border-border/60 pt-5">
          <Button onClick={() => void submit()} disabled={markDeceased.isPending}>
            {markDeceased.isPending && <Loader2 aria-hidden className="animate-spin" />}
            Save
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={markDeceased.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}