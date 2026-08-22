import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { PARENT_RELATION_LABELS, type MemberSummary, type ParentRelationType } from '@fh/shared';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';

/** How the new person attaches to someone already in the tree. */
export type ConnectionRelation = 'CHILD' | 'PARENT' | 'PARTNER' | 'SIBLING' | 'NONE';

export interface Connection {
  relation: ConnectionRelation;
  anchorId: string;
  /** Only for CHILD: the second parent, usually the anchor's partner. */
  otherParentId: string;
  relationType: ParentRelationType;
}

export const EMPTY_CONNECTION: Connection = {
  // Child of someone is by far the commonest thing a person adds, so it is the
  // default - but nothing happens until an actual person is chosen below.
  relation: 'CHILD',
  anchorId: '',
  otherParentId: '',
  relationType: 'BIOLOGICAL',
};

/**
 * Phrased from the new person outward, because that is the direction people
 * think in. "Sarah is the daughter of Peter" is a sentence someone can check
 * against what they know; "Peter has a child relationship to Sarah" is a
 * database row read aloud.
 */
const RELATION_LABELS: Record<Exclude<ConnectionRelation, 'NONE'>, string> = {
  CHILD: 'a son or daughter of',
  PARENT: 'a parent of',
  PARTNER: 'a husband, wife or partner of',
  SIBLING: 'a brother or sister of',
};

/**
 * Connects a new person to someone already recorded.
 *
 * Only four links are offered, and that is not a limitation - it is the whole
 * design. Grandparent, uncle, cousin and niece are not stored anywhere; they
 * are worked out from these four. Someone adding an uncle records him as a
 * brother of a parent, and the product then knows he is an uncle to every one
 * of that parent's children, for ever, without anyone maintaining it.
 *
 * Offering "uncle" as a link would mean storing a fact that is already implied,
 * and stored facts that duplicate derived ones drift apart.
 */
export function ConnectionPicker({
  members,
  value,
  onChange,
}: {
  members: MemberSummary[];
  value: Connection;
  onChange: (value: Connection) => void;
}) {
  const anchor = useMemo(
    () => members.find((member) => member.id === value.anchorId),
    [members, value.anchorId],
  );

  const set = <K extends keyof Connection>(key: K, next: Connection[K]) =>
    onChange({ ...value, [key]: next });

  if (members.length === 0) return null;

  const connected = value.relation !== 'NONE';
  const otherParents = members.filter((member) => member.id !== value.anchorId);

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-2">
        <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="font-serif text-lg tracking-tight">How are they connected?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Recording this now is what turns a list of names into a family tree. Uncles, cousins
            and grandparents are worked out from these links — an uncle is recorded as a brother
            of a parent, and the rest follows.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="This person is…" htmlFor="connection-relation">
          <Select
            id="connection-relation"
            value={value.relation}
            onChange={(event) => set('relation', event.target.value as ConnectionRelation)}
          >
            {Object.entries(RELATION_LABELS).map(([relation, label]) => (
              <option key={relation} value={relation}>
                {label}
              </option>
            ))}
            <option value="NONE">not connected to anyone yet</option>
          </Select>
        </FormField>

        {connected && (
          <FormField label="…this person" htmlFor="connection-anchor">
            <Select
              id="connection-anchor"
              value={value.anchorId}
              onChange={(event) => set('anchorId', event.target.value)}
            >
              <option value="">Choose someone</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </div>

      {/* A child has two parents, and the second is a tap away rather than a
          task for later - which is when it stops happening. */}
      {value.relation === 'CHILD' && value.anchorId && (
        <FormField
          label="And the other parent, if you know them"
          htmlFor="connection-other-parent"
          hint="Leave blank if you are not sure, or if they are not recorded yet."
        >
          <Select
            id="connection-other-parent"
            value={value.otherParentId}
            onChange={(event) => set('otherParentId', event.target.value)}
          >
            <option value="">Not known, or not yet added</option>
            {otherParents.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {(value.relation === 'CHILD' || value.relation === 'PARENT') && value.anchorId && (
        <FormField
          label="Kind of parentage"
          htmlFor="connection-type"
          hint="Adoptive and biological are both real, and both belong in the record."
        >
          <Select
            id="connection-type"
            value={value.relationType}
            onChange={(event) => set('relationType', event.target.value as ParentRelationType)}
          >
            {Object.entries(PARENT_RELATION_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {connected && anchor && (
        <p className="text-sm text-muted-foreground">
          Will be recorded as {RELATION_LABELS[value.relation as Exclude<ConnectionRelation, 'NONE'>]}{' '}
          <span className="text-foreground">{anchor.displayName}</span>.
        </p>
      )}

      {value.relation === 'NONE' && (
        <p className="text-sm text-muted-foreground text-pretty">
          They will be added on their own. You can connect them from their profile later, though
          a person nobody is linked to is easy to forget about.
        </p>
      )}

      {value.relation === 'SIBLING' && value.anchorId && (
        <p className="text-xs text-muted-foreground text-pretty">
          They will be linked to the same parents, which is what makes them siblings. If that
          person has no parents recorded yet, add one first.
        </p>
      )}
    </section>
  );
}