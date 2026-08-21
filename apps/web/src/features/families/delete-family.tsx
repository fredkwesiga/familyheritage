import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useCurrentFamily } from '@/features/families/family-context';
import { useDeleteFamily } from '@/features/families/use-families';
import { ApiError } from '@/lib/api-client';

/**
 * Removing a whole family record.
 *
 * Two things are true at once, and the design has to hold both: this is
 * genuinely dangerous, and it must genuinely be possible. Someone who created
 * a family by mistake, or twice, needs a way out - and a product that lets you
 * delete a person but not the empty shell you made in the first minute is
 * quietly telling you it does not trust you with your own records.
 *
 * So: last on the page, behind a typed confirmation, with the count of what
 * will go stated plainly. Typing the name is not friction for its own sake -
 * it is the difference between an accident and a decision.
 */
export function DeleteFamilySection() {
  const { family, can } = useCurrentFamily();
  const navigate = useNavigate();
  const deleteFamily = useDeleteFamily();

  const [confirmation, setConfirmation] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  if (!can(Permission.FAMILY_DELETE)) return null;

  const matches = confirmation.trim() === family.name.trim();

  const remove = async () => {
    setError('');
    try {
            await deleteFamily.mutateAsync({
        familyId: family.id,
        confirmFamilyName: confirmation.trim(),
      });
      void navigate('/families', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not remove this family.',
      );
    }
  };

  return (
    <section className="space-y-5 border-t border-border/60 pt-10">
      <h2 className="font-serif text-xl tracking-tight">Remove this family</h2>

      <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/3 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm leading-relaxed text-pretty">
              This removes {family.name} for everyone who has access to it —{' '}
              {family.memberCount === 1
                ? 'the one person recorded'
                : `all ${family.memberCount} people recorded`}
              , along with every story, photograph and relationship.
            </p>
            {/* Said before the decision, not after. Downloading takes a minute
                and is the difference between a mistake and a loss. */}
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              If there is anything here worth keeping, take a copy first — the
              download is just above.
            </p>
          </div>
        </div>

        <FormMessage>{error}</FormMessage>

        {!open ? (
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/5"
            onClick={() => setOpen(true)}
          >
            Remove this family
          </Button>
        ) : (
          <div className="space-y-4">
            <FormField
              label={`Type “${family.name}” to confirm`}
              htmlFor="confirm-family-name"
              hint="Typing the name is the difference between an accident and a decision."
            >
              <Input
                id="confirm-family-name"
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={family.name}
              />
            </FormField>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
                disabled={!matches || deleteFamily.isPending}
                onClick={() => void remove()}
              >
                {deleteFamily.isPending && <Loader2 aria-hidden className="animate-spin" />}
                Remove {family.name}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setConfirmation('');
                  setError('');
                }}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}