import { Link } from 'react-router-dom';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { immediateRelatives, type MemberSummary } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import type { TreeData } from './use-tree';
import { TreeNodeCard } from './tree-node-card';

/**
 * The focus view.
 *
 * One person in the middle, parents above, partners beside, siblings across,
 * children below. Tap anyone to re-centre.
 *
 * This is the default on every screen size, not a mobile fallback. Two reasons.
 * A two-hundred-node canvas is unreadable on a phone and only marginally better
 * on a laptop once a family passes about sixty people. And more importantly it
 * matches how people actually think about their family - "who was my
 * grandmother's sister?" is a question about one person's immediate circle, not
 * a request to read a diagram.
 *
 * The canvas view in Phase 8B is the addition for people who want to see the
 * whole shape at once.
 */
export function FocusView({
  tree,
  focusId,
  onFocus,
}: {
  tree: TreeData;
  focusId: string;
  onFocus: (memberId: string) => void;
}) {
  const { family } = useCurrentFamily();
  const focus = tree.byId.get(focusId);

  if (!focus) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        That person is no longer in the tree.
      </p>
    );
  }

  const { parentIds, childIds, partnerIds, siblings } = immediateRelatives(tree.graph, focusId);

  const resolve = (ids: string[]): MemberSummary[] =>
    ids.map((id) => tree.byId.get(id)).filter((member): member is MemberSummary => Boolean(member));

  const parents = resolve(parentIds);
  const children = resolve(childIds);
  const partners = resolve(partnerIds);
  const siblingMembers = siblings
    .map((sibling) => ({ member: tree.byId.get(sibling.id), half: sibling.half }))
    .filter((entry): entry is { member: MemberSummary; half: boolean } => Boolean(entry.member));

  const isolated =
    parents.length === 0 &&
    children.length === 0 &&
    partners.length === 0 &&
    siblingMembers.length === 0;

  return (
    <div className="space-y-8">
      {/* --- Parents, above -------------------------------------------- */}
      {parents.length > 0 && (
        <Row label="Parents">
          {parents.map((parent) => (
            <div key={parent.id} className="w-40">
              <TreeNodeCard member={parent} onSelect={onFocus} size="sm" />
            </div>
          ))}
        </Row>
      )}

      {parents.length > 0 && <Connector />}

      {/* --- The focused person, with partners beside them -------------- */}
      <div className="flex flex-wrap items-stretch justify-center gap-3">
        <div className="w-52">
          <TreeNodeCard member={focus} onSelect={onFocus} isFocus />
        </div>
        {partners.map((partner) => (
          <div key={partner.id} className="w-44">
            <TreeNodeCard member={partner} onSelect={onFocus} note={partnerWord(partner.gender)} size="sm" />
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button asChild variant="outline" size="sm">
          <Link to={`/f/${family.id}/members/${focus.id}`}>
            Open {focus.displayName.split(' ')[0]}'s profile
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      {/* --- Siblings, across ------------------------------------------- */}
      {siblingMembers.length > 0 && (
        <Row label="Brothers and sisters">
          {siblingMembers.map(({ member, half }) => (
            <div key={member.id} className="w-40">
              <TreeNodeCard
                member={member}
                onSelect={onFocus}
                note={half ? 'half' : undefined}
                size="sm"
              />
            </div>
          ))}
        </Row>
      )}

      {/* --- Children, below -------------------------------------------- */}
      {children.length > 0 && <Connector />}

      {children.length > 0 && (
        <Row label="Children">
          {children.map((child) => (
            <div key={child.id} className="w-40">
              <TreeNodeCard member={child} onSelect={onFocus} size="sm" />
            </div>
          ))}
        </Row>
      )}

      {isolated && (
        <div className="mx-auto max-w-sm space-y-3 pt-4 text-center">
          <p className="text-muted-foreground text-pretty">
            {focus.displayName} has no relatives recorded yet. Adding a parent or a child is what
            gives the tree its shape.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to={`/f/${family.id}/members/${focus.id}`}>Add a relative</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** "wife" and "husband" are what a family says. "Partner" is what a form says. */
function partnerWord(gender: string | null): string {
  const normalized = gender?.trim().toLowerCase() ?? '';
  if (['female', 'f', 'woman', 'girl'].includes(normalized)) return 'wife';
  if (['male', 'm', 'man', 'boy'].includes(normalized)) return 'husband';
  return 'partner';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-wrap items-stretch justify-center gap-3">{children}</div>
    </section>
  );
}

/** A short vertical line, so the generations read as connected rather than stacked. */
function Connector() {
  return (
    <div aria-hidden className="flex justify-center">
      <ArrowUp className="size-4 rotate-180 text-border" />
    </div>
  );
}