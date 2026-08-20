import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Users } from 'lucide-react';
import { Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import { MemberCard } from '@/features/members/member-card';
import { MemberSearch } from '@/features/members/member-search';
import { useMembers } from '@/features/members/use-members';

export function MembersPage() {
  const { family, can } = useCurrentFamily();
  const [showRemoved, setShowRemoved] = useState(false);
  const { data, isPending } = useMembers(family.id, showRemoved);

  const canAdd = can(Permission.MEMBER_CREATE);
  const canSeeRemoved = can(Permission.MEMBER_DELETE);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const members = data?.members ?? [];

  if (members.length === 0 && !showRemoved) {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-8 text-center">
        <Users aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <div className="space-y-3">
          <h1 className="font-serif text-3xl tracking-tight text-balance">
            Start with someone you know well
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            Yourself, a parent, a grandparent — it does not matter which. A name is enough to
            begin; dates and stories can come later, or never.
          </p>
        </div>
        {canAdd && (
          <Button asChild size="lg">
            <Link to={`/f/${family.id}/members/new`}>
              <Plus aria-hidden />
              Add the first person
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Relatives</h1>
          <p className="text-muted-foreground">
            {data?.total === 1 ? 'One person recorded' : `${data?.total ?? 0} people recorded`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canSeeRemoved && (
            <Button variant="ghost" size="sm" onClick={() => setShowRemoved((value) => !value)}>
              {showRemoved ? 'Hide removed' : 'Show removed'}
            </Button>
          )}
          {canAdd && (
            <Button asChild variant="outline">
              <Link to={`/f/${family.id}/members/new`}>
                <Plus aria-hidden />
                Add person
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Search only earns its place once a list stops being scannable. Below
          that, it is a control asking to be ignored. */}
      {(data?.total ?? 0) > 8 && <MemberSearch />}

      <ul className="grid gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <li key={member.id}>
            <MemberCard member={member} to={`/f/${family.id}/members/${member.id}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}