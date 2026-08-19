import { Link } from 'react-router-dom';
import { Loader2, Plus, X } from 'lucide-react';
import {
  formatApproximateDate,
  formatLifeDates,
  PARENT_RELATION_LABELS,
  PARTNERSHIP_STATUS_LABELS,
  Permission,
  type MemberRelations,
  type MemberSummary,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import { MemberAvatar } from '@/features/members/member-avatar';
import type { RelationKind } from './add-relative-dialog';
import { useDeletePartnership, useUnlinkParentChild } from './use-relationships';

interface RelationsSectionProps {
  relations: MemberRelations | undefined;
  isPending: boolean;
  onAdd: (relation: RelationKind) => void;
}

export function RelationsSection({ relations, isPending, onAdd }: RelationsSectionProps) {
  const { family, can } = useCurrentFamily();
  const unlinkParent = useUnlinkParentChild(family.id);
  const deletePartnership = useDeletePartnership(family.id);

  const canEdit = can(Permission.RELATIONSHIP_WRITE);

  if (isPending) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 aria-label="Loading relatives" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!relations) return null;

  // Siblings come from shared parents, so with no parents recorded there is
  // nothing to derive from. Saying so is more useful than a disabled button
  // with no explanation.
  const canAddSibling = relations.parents.length > 0;

  const removeParentLink = async (linkId: string, name: string) => {
    if (!window.confirm(`Remove the link to ${name}? Both people stay in the tree.`)) return;
    await unlinkParent.mutateAsync(linkId);
  };

  const removePartnership = async (linkId: string, name: string) => {
    if (!window.confirm(`Remove the partnership with ${name}? Both people stay in the tree.`))
      return;
    await deletePartnership.mutateAsync(linkId);
  };

  return (
    <div className="space-y-8">
      <Group
        title="Parents"
        empty="No parents recorded."
        onAdd={canEdit ? () => onAdd('PARENT') : undefined}
        addLabel="Add a parent"
      >
        {relations.parents.map((link) => (
          <Row
            key={link.linkId}
            member={link.member}
            familyId={family.id}
            note={
              link.relationType === 'BIOLOGICAL'
                ? undefined
                : PARENT_RELATION_LABELS[link.relationType]
            }
            onRemove={
              canEdit
                ? () => void removeParentLink(link.linkId, link.member.displayName)
                : undefined
            }
          />
        ))}
      </Group>

      <Group
        title="Partners"
        empty="No partnerships recorded."
        onAdd={canEdit ? () => onAdd('PARTNER') : undefined}
        addLabel="Add a partner"
      >
        {relations.partners.map((link) => {
          const when = formatApproximateDate(link.start);
          return (
            <Row
              key={link.linkId}
              member={link.member}
              familyId={family.id}
              note={[PARTNERSHIP_STATUS_LABELS[link.status], when].filter(Boolean).join(' · ')}
              onRemove={
                canEdit
                  ? () => void removePartnership(link.linkId, link.member.displayName)
                  : undefined
              }
            />
          );
        })}
      </Group>

      <Group
        title="Brothers and sisters"
        empty={
          canAddSibling
            ? 'No brothers or sisters recorded.'
            : 'Add a parent first — brothers and sisters are worked out from shared parents.'
        }
        onAdd={canEdit && canAddSibling ? () => onAdd('SIBLING') : undefined}
        addLabel="Add a sibling"
      >
        {relations.siblings.map((link) => (
          <Row
            key={link.member.id}
            member={link.member}
            familyId={family.id}
            /* Half is stated; full is the unremarkable case and goes unlabelled. */
            note={link.kind === 'HALF' ? 'Half' : undefined}
          />
        ))}
      </Group>

      <Group
        title="Children"
        empty="No children recorded."
        onAdd={canEdit ? () => onAdd('CHILD') : undefined}
        addLabel="Add a child"
      >
        {relations.children.map((link) => (
          <Row
            key={link.linkId}
            member={link.member}
            familyId={family.id}
            note={
              link.relationType === 'BIOLOGICAL'
                ? undefined
                : PARENT_RELATION_LABELS[link.relationType]
            }
            onRemove={
              canEdit
                ? () => void removeParentLink(link.linkId, link.member.displayName)
                : undefined
            }
          />
        ))}
      </Group>
    </div>
  );
}

function Group({
  title,
  empty,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  empty: string;
  addLabel: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean) && items.flat().length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-serif text-lg tracking-tight">{title}</h3>
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            {addLabel}
          </Button>
        )}
      </div>

      {hasItems ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function Row({
  member,
  familyId,
  note,
  onRemove,
}: {
  member: MemberSummary;
  familyId: string;
  note?: string;
  onRemove?: () => void;
}) {
  const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5">
      <Link
        to={`/f/${familyId}/members/${member.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MemberAvatar
        memberId={member.id}
          displayName={member.displayName}
          livingStatus={member.livingStatus}
          size="sm"
        />
        <span className="min-w-0">
          <span className="block truncate font-serif">{member.displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[lifeDates, note].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>

      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove the link to ${member.displayName}`}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      )}
    </li>
  );
}