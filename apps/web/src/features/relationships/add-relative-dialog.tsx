import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  PARENT_RELATION_LABELS,
  parentRelationTypeSchema,
  type AddRelativeInput,
  type LivingStatus,
  type Member,
  type ParentRelationType,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import { useAddRelative } from './use-relationships';

export type RelationKind = AddRelativeInput['relation'];

const TITLES: Record<RelationKind, (name: string) => string> = {
  PARENT: (name) => `Add a parent of ${name}`,
  CHILD: (name) => `Add a child of ${name}`,
  SIBLING: (name) => `Add a brother or sister of ${name}`,
  PARTNER: (name) => `Add a partner of ${name}`,
};

const BLURBS: Record<RelationKind, string> = {
  PARENT: 'A name is enough. Dates and details can be filled in from their profile later.',
  CHILD: 'A name is enough. Dates and details can be filled in from their profile later.',
  SIBLING: 'They will be linked to the same parents, which is what makes them siblings.',
  PARTNER: 'A marriage, a partnership, or a union — the dates can come later.',
};

/**
 * The heart of the "add a relative" flow.
 *
 * The relationship comes from which button was pressed, not from a dropdown the
 * user has to reason about. Asking someone to add a person and *then* describe
 * how they are related is where these products lose people, because it turns a
 * memory ("my grandmother") into a data-modelling exercise.
 *
 * The form is deliberately minimal - two names, whether they are a woman or a
 * man, and where it matters the kind of parentage. Everything else belongs on
 * the profile, later, if ever.
 */
export function AddRelativeDialog({
  anchor,
  familyId,
  relation,
  onClose,
  onAdded,
}: {
  anchor: Member;
  familyId: string;
  relation: RelationKind | null;
  onClose: () => void;
  onAdded?: (memberId: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addRelative = useAddRelative(familyId, anchor.id);

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [livingStatus, setLivingStatus] = useState<LivingStatus>('UNKNOWN');
  const [gender, setGender] = useState('');
  const [relationType, setRelationType] = useState<ParentRelationType>('BIOLOGICAL');
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (relation && !dialog.open) {
      // Reset each time it opens, so the previous relative's name is not
      // sitting in the field.
      setGivenName('');
      setFamilyName('');
      setLivingStatus('UNKNOWN');
      setGender('');
      setRelationType('BIOLOGICAL');
      setError('');
      dialog.showModal();
    }
    if (!relation && dialog.open) dialog.close();
  }, [relation]);

  if (!relation) return <dialog ref={dialogRef} className="hidden" />;

  const showParentageType = relation === 'PARENT' || relation === 'CHILD';

  const submit = async () => {
    setError('');
    if (!givenName.trim() && !familyName.trim()) {
      setError('Enter at least a first or last name.');
      return;
    }

    try {
      const member = await addRelative.mutateAsync({
        relation,
        member: {
          givenName: givenName.trim() || undefined,
          familyName: familyName.trim() || undefined,
          gender: gender || undefined,
          livingStatus,
        },
        ...(showParentageType ? { relationType } : {}),
      });
      onAdded?.(member.id);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not add that person.',
      );
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground backdrop:bg-foreground/20 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-6 p-6">
        <header className="space-y-2">
          <h2 className="font-serif text-2xl tracking-tight">
            {TITLES[relation](anchor.displayName)}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{BLURBS[relation]}</p>
        </header>

        <FormMessage>{error}</FormMessage>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="relative-given">
            <Input
              id="relative-given"
              autoFocus
              value={givenName}
              onChange={(event) => setGivenName(event.target.value)}
            />
          </FormField>

          <FormField label="Last name" htmlFor="relative-family">
            <Input
              id="relative-family"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
            />
          </FormField>
        </div>

        {/* Asked here rather than left for later, because without it the
            product can only say "aunt or uncle" and "niece or nephew" - and a
            family reading their own tree should see the word they would use. */}
        <FormField
          label="Woman or man?"
          htmlFor="relative-gender"
          hint="Only used to choose the right word: mother or father, aunt or uncle."
        >
          <Select
            id="relative-gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="">Not known</option>
            <option value="female">Woman</option>
            <option value="male">Man</option>
          </Select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Are they living?"
            htmlFor="relative-status"
            hint="“Not known” is a fine answer."
          >
            <Select
              id="relative-status"
              value={livingStatus}
              onChange={(event) => setLivingStatus(event.target.value as LivingStatus)}
            >
              <option value="UNKNOWN">Not known</option>
              <option value="LIVING">Living</option>
              <option value="DECEASED">Has passed away</option>
            </Select>
          </FormField>

          {showParentageType && (
            <FormField
              label="Kind of parent"
              htmlFor="relative-type"
              hint="Adoptive and biological can both be true."
            >
              <Select
                id="relative-type"
                value={relationType}
                onChange={(event) =>
                  setRelationType(parentRelationTypeSchema.parse(event.target.value))
                }
              >
                {Object.entries(PARENT_RELATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/60 pt-5">
          <Button onClick={() => void submit()} disabled={addRelative.isPending}>
            {addRelative.isPending && <Loader2 aria-hidden className="animate-spin" />}
            Add
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={addRelative.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}