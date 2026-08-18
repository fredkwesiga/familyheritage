import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Member } from '@fh/shared';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { useCurrentFamily } from '@/features/families/family-context';
import { useMembers } from '@/features/members/use-members';
import { RelationshipAnswerCard } from './relationship-answer';
import { useRelationshipTo } from './use-relationships';

/**
 * "How is this person related to…?"
 *
 * A native select over the family's members. At ten to a hundred people that is
 * the right control: on a phone it opens the platform picker, it is searchable
 * by typing in every browser, and it needs no keyboard semantics of our own.
 * A combobox becomes worth building at a few hundred members, not before.
 */
export function RelationshipFinder({ anchor }: { anchor: Member }) {
  const { family } = useCurrentFamily();
  const { data } = useMembers(family.id);
  const [otherId, setOtherId] = useState('');

  const { data: answer, isFetching } = useRelationshipTo(family.id, anchor.id, otherId || null);

  const candidates = (data?.members ?? []).filter((member) => member.id !== anchor.id);

  if (candidates.length === 0) return null;

  return (
    <div className="space-y-4">
      <FormField
        label={`How is ${anchor.displayName} related to…`}
        htmlFor="relationship-other"
      >
        <Select
          id="relationship-other"
          value={otherId}
          onChange={(event) => setOtherId(event.target.value)}
        >
          <option value="">Choose someone</option>
          {candidates.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
      </FormField>

      {isFetching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="animate-spin" />
          Working it out…
        </p>
      )}

      {answer && !isFetching && (
        <RelationshipAnswerCard
          answer={answer}
          fromIsYou={anchor.isYou}
          familyId={family.id}
        />
      )}
    </div>
  );
}

/**
 * The answer to the question people actually ask, without being asked for.
 *
 * When the reader has claimed their own record, "how am I related to this
 * person?" has a definite answer the moment they open a profile - so we show it
 * rather than making them operate a control to get it.
 */
export function RelationshipToYou({ member }: { member: Member }) {
  const { family } = useCurrentFamily();
  const yourId = family.yourClaimedMemberId;

  const { data: answer } = useRelationshipTo(family.id, yourId, member.id);

  if (!yourId || yourId === member.id || !answer) return null;
  if (answer.kind === 'SELF') return null;

  return <RelationshipAnswerCard answer={answer} fromIsYou familyId={family.id} />;
}