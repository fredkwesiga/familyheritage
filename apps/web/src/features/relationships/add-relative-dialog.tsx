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
import { useMembers } from '@/features/members/use-members';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAddRelative, useLinkParentChild, useRelations } from './use-relationships';

export type RelationKind = AddRelativeInput['relation'];

const TITLES: Record<RelationKind, (name: string) => string> = {
  PARENT: (name) => `Add a parent of ${name}`,
  CHILD: (name) => `Add a child of ${name}`,
  SIBLING: (name) => `Add a brother or sister of ${name}`,
  PARTNER: (name) => `Add a partner of ${name}`,
};

const BLURBS: Record<RelationKind, string> = {
  PARENT: 'A name is enough. Dates and details can be filled in from their profile later.',
  CHILD:
    'Record both parents now if you know them — it is much harder to remember to come back and do it.',
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
 * man, the other parent where there is one, and the kind of parentage where it
 * matters. Everything else belongs on the profile, later, if ever.
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
  const linkParent = useLinkParentChild(familyId);
  const { data: memberData } = useMembers(familyId);
  const { data: relations } = useRelations(familyId, anchor.id);

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [livingStatus, setLivingStatus] = useState<LivingStatus>('UNKNOWN');
  const [gender, setGender] = useState('');
  const [relationType, setRelationType] = useState<ParentRelationType>('BIOLOGICAL');
  const [otherParentId, setOtherParentId] = useState('');
  const [alsoParentOf, setAlsoParentOf] = useState<string[]>([]);
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
      setOtherParentId('');
      setAlsoParentOf([]);
      setError('');
      dialog.showModal();
    }
    if (!relation && dialog.open) dialog.close();
  }, [relation]);

  if (!relation) return <dialog ref={dialogRef} className="hidden" />;

  const showParentageType = relation === 'PARENT' || relation === 'CHILD';

  /**
   * A child has two parents, and the moment to record the second one is now.
   *
   * Adding a child from a father's profile and leaving the mother for later is
   * how a tree fills up with people connected to only half of where they came
   * from - and "later" rarely arrives. The anchor's partners are listed first,
   * because in almost every case the other parent is one of them.
   */
  const partnerIds = new Set((relations?.partners ?? []).map((link) => link.member.id));
  const candidates = (memberData?.members ?? []).filter((member) => member.id !== anchor.id);
  const partnerCandidates = candidates.filter((member) => partnerIds.has(member.id));
  const otherCandidates = candidates.filter((member) => !partnerIds.has(member.id));

  /**
   * People the new person may also be a parent of.
   *
   * Adding a husband to a woman who already has children recorded links him to
   * her and to nobody else - so her children end up with one parent in the
   * tree, which is exactly the disconnection this dialog is meant to prevent.
   * The same applies to adding a parent when the anchor has brothers and
   * sisters: that parent is usually theirs too.
   *
   * Nothing is ticked by default, on purpose. Where a man has children with
   * several women, assuming a new wife is the mother of the existing children
   * would write something false into the record - and a wrong parent is far
   * worse than a missing one.
   */
  const alsoParentCandidates =
    relation === 'PARTNER'
      ? (relations?.children ?? []).map((link) => link.member)
      : relation === 'PARENT'
        ? (relations?.siblings ?? []).map((link) => link.member)
        : [];

  const toggleAlsoParent = (memberId: string) =>
    setAlsoParentOf((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );

  const busy = addRelative.isPending || linkParent.isPending;

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

      // The second parent is a separate edge, written straight after the
      // first. Two independent links, which is what lets a father's children
      // by different mothers all be his without any of them belonging to a
      // couple.
      if (relation === 'CHILD' && otherParentId) {
        await linkParent.mutateAsync({
          parentId: otherParentId,
          childId: member.id,
          relationType,
        });
      }

      // Sequential rather than parallel: each is an independent edge, and if
      // one fails the others should already be saved rather than all rolled
      // back together.
      for (const childId of alsoParentOf) {
        await linkParent.mutateAsync({
          parentId: member.id,
          childId,
          relationType: 'BIOLOGICAL',
        });
      }

      onAdded?.(member.id);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add that person.');
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

        {relation === 'CHILD' && candidates.length > 0 && (
          <FormField
            label="Who is the other parent?"
            htmlFor="relative-other-parent"
            hint={`${anchor.displayName} is recorded automatically. Leave this blank if you are not sure.`}
          >
            <Select
              id="relative-other-parent"
              value={otherParentId}
              onChange={(event) => setOtherParentId(event.target.value)}
            >
              <option value="">Not known, or not yet added</option>
              {partnerCandidates.length > 0 && (
                <optgroup label={`${anchor.displayName}'s partners`}>
                  {partnerCandidates.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherCandidates.length > 0 && (
                <optgroup label="Everyone else">
                  {otherCandidates.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </FormField>
        )}

        {alsoParentCandidates.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground/90">
              {relation === 'PARTNER'
                ? `Are they also a parent of ${anchor.displayName}'s children?`
                : `Are they also a parent of ${anchor.displayName}'s brothers and sisters?`}
            </legend>
            <p className="text-xs text-muted-foreground text-pretty">
              Choose any that apply. Nothing is assumed — a wrong parent is harder to notice, and
              harder to undo, than a missing one.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {alsoParentCandidates.map((child) => {
                const chosen = alsoParentOf.includes(child.id);
                return (
                  <button
                    key={child.id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => toggleAlsoParent(child.id)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chosen
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                    )}
                  >
                    {child.displayName}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

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
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />}
            Add
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}