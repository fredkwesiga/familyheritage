import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import type { AddRelativeInput } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import { useClaimMember, useCreateMember } from '@/features/members/use-members';
import {
  AddedList,
  OnboardingStepFrame,
  type OnboardingStep,
} from '@/features/onboarding/onboarding-step';
import { QuickAddPerson } from '@/features/onboarding/quick-add-person';
import { addRelative } from '@/features/relationships/api';
import { ApiError } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * The guided start.
 *
 * The single biggest risk to this product is not a technical one: it is a
 * family record with three people in it that nobody ever returns to. An empty
 * canvas with an "Add member" button is where that happens - it asks someone to
 * plan a data model when all they wanted was to write down their grandmother's
 * name.
 *
 * So the first session asks four questions instead, in the order a person
 * actually thinks about their family, and a tree with six or eight people in it
 * exists before anyone has been asked for a date.
 */
export function OnboardingPage() {
  const { family } = useCurrentFamily();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMember = useCreateMember(family.id);
  const [selfId, setSelfId] = useState<string | null>(family.yourClaimedMemberId);
  const claimSelf = useClaimMember(family.id, selfId ?? '');

  const [step, setStep] = useState<OnboardingStep>('you');
  const [added, setAdded] = useState<Record<OnboardingStep, string[]>>({
    you: [],
    parents: [],
    siblings: [],
    children: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const record = (which: OnboardingStep, name: string) =>
    setAdded((previous) => ({ ...previous, [which]: [...previous[which], name] }));

  const finish = () => {
    void queryClient.invalidateQueries({ queryKey: ['families', family.id] });
    void navigate(`/f/${family.id}/tree`, { replace: true });
  };

  // ---- Step 1: you -------------------------------------------------------

  const addSelf = async (person: { givenName: string; familyName: string; gender: string }) => {
    setBusy(true);
    setError('');
    try {
      const member = await createMember.mutateAsync({
        givenName: person.givenName || undefined,
        familyName: person.familyName || undefined,
        gender: person.gender || undefined,
        livingStatus: 'LIVING',
      });
      setSelfId(member.id);
      record('you', member.displayName);

      // Claiming immediately is what makes "how am I related to X?" answerable
      // from the reader's own position, and what centres the tree on them.
      await claimSelf.mutateAsync().catch(() => undefined);
      setStep('parents');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Steps 2-4: relatives ---------------------------------------------

  const addRelation = async (
    relation: AddRelativeInput['relation'],
    person: { givenName: string; familyName: string; gender: string },
    which: OnboardingStep,
  ) => {
    if (!selfId) return;
    setBusy(true);
    setError('');
    try {
      const member = await addRelative(family.id, selfId, {
        relation,
        member: {
          givenName: person.givenName || undefined,
          familyName: person.familyName || undefined,
          gender: person.gender || undefined,
          livingStatus: 'UNKNOWN',
        },
      });
      record(which, member.displayName);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add that person.');
    } finally {
      setBusy(false);
    }
  };

  const skipLink = (
    <p className="text-center text-sm text-muted-foreground">
      <Link
        to={`/f/${family.id}/members`}
        className="underline-offset-4 hover:underline"
      >
        I'll do this later
      </Link>
    </p>
  );

  // ------------------------------------------------------------------ render

  if (step === 'you') {
    return (
      <div className="space-y-8 py-4">
        <OnboardingStepFrame
          step="you"
          question="Let's start with you."
          hint="Everyone else in the tree will sit somewhere relative to you, so this is the easiest place to begin."
          onContinue={() => setStep('parents')}
          continueLabel="Next"
          canContinue={Boolean(selfId)}
        >
          <FormMessage>{error}</FormMessage>
          {selfId ? (
            <AddedList names={added.you} />
          ) : (
            <QuickAddPerson
              label="Your name"
              busy={busy}
              onAdd={addSelf}
              placeholderFirst="Fred"
              placeholderLast="Kwesiga"
            />
          )}
        </OnboardingStepFrame>
        {skipLink}
      </div>
    );
  }

  if (step === 'parents') {
    return (
      <div className="space-y-8 py-4">
        <OnboardingStepFrame
          step="parents"
          question="Who are your parents?"
          hint="Add either, both, or neither. If you are not sure of a name, leave it — someone else in the family may know."
          onContinue={() => setStep('siblings')}
          continueLabel={added.parents.length > 0 ? 'Next' : 'Skip this'}
        >
          <FormMessage>{error}</FormMessage>
          <QuickAddPerson
            label="Add a parent"
            busy={busy}
            onAdd={(person) => addRelation('PARENT', person, 'parents')}
          />
          <AddedList names={added.parents} />
        </OnboardingStepFrame>
        {skipLink}
      </div>
    );
  }

  if (step === 'siblings') {
    // Siblings hang off shared parents, so this step is only meaningful once
    // a parent exists. Rather than show a control that would fail, we say why.
    const hasParents = added.parents.length > 0;

    return (
      <div className="space-y-8 py-4">
        <OnboardingStepFrame
          step="siblings"
          question="Any brothers or sisters?"
          hint={
            hasParents
              ? 'They will be linked to the same parents, which is what makes them your siblings.'
              : 'Brothers and sisters are worked out from shared parents, so this needs a parent first. You can come back to it.'
          }
          onContinue={() => setStep('children')}
          continueLabel={added.siblings.length > 0 ? 'Next' : 'Skip this'}
        >
          <FormMessage>{error}</FormMessage>
          {hasParents && (
            <QuickAddPerson
              label="Add a brother or sister"
              busy={busy}
              onAdd={(person) => addRelation('SIBLING', person, 'siblings')}
            />
          )}
          <AddedList names={added.siblings} />
        </OnboardingStepFrame>
        {skipLink}
      </div>
    );
  }

  if (step === 'children') {
    return (
      <div className="space-y-8 py-4">
        <OnboardingStepFrame
          step="children"
          question="Do you have children?"
          hint="The people this record is really being kept for."
          onContinue={finish}
          continueLabel={added.children.length > 0 ? 'See the tree' : 'Skip and see the tree'}
        >
          <FormMessage>{error}</FormMessage>
          <QuickAddPerson
            label="Add a child"
            busy={busy}
            onAdd={(person) => addRelation('CHILD', person, 'children')}
          />
          <AddedList names={added.children} />
        </OnboardingStepFrame>
        {skipLink}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-16">
      <Loader2 aria-hidden className="animate-spin text-muted-foreground" />
    </div>
  );
}

/** Shown on the family overview when nobody has been added yet. */
export function OnboardingInvitation({ familyId }: { familyId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Sparkles aria-hidden className="mx-auto size-7 text-accent" />
      <h2 className="mt-4 font-serif text-2xl tracking-tight text-balance">
        Four questions, and you'll have a family tree
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-pretty">
        No dates, no photographs, nothing to look up. Just a few names you already know.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link to={`/f/${familyId}/start`}>Start</Link>
      </Button>
    </div>
  );
}