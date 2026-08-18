import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, EyeOff, Loader2, Pencil, Trash2, UserCheck } from 'lucide-react';
import { formatApproximateDate, formatLifeDates, Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import { MarkDeceasedDialog } from '@/features/members/mark-deceased-dialog';
import { MemberAvatar } from '@/features/members/member-avatar';
import {
  AddRelativeDialog,
  type RelationKind,
} from '@/features/relationships/add-relative-dialog';
import { RelationsSection } from '@/features/relationships/relations-section';
import {
  RelationshipFinder,
  RelationshipToYou,
} from '@/features/relationships/relationship-finder';
import { useRelations } from '@/features/relationships/use-relationships';
import {
  useClaimMember,
  useDeleteMember,
  useMember,
  useSetLivingStatus,
} from '@/features/members/use-members';

export function MemberProfilePage() {
  const { family, can } = useCurrentFamily();
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { data: member, isPending, isError } = useMember(family.id, memberId);

  const [deceasedOpen, setDeceasedOpen] = useState(false);
  const [addRelation, setAddRelation] = useState<RelationKind | null>(null);
  const { data: relations, isPending: relationsPending } = useRelations(family.id, memberId);

  const claim = useClaimMember(family.id, memberId ?? '');
  const setLivingStatus = useSetLivingStatus(family.id, memberId ?? '');
  const deleteMember = useDeleteMember(family.id);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !member) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="font-serif text-2xl tracking-tight">This person isn't in the tree</h1>
        <Button asChild variant="outline">
          <Link to={`/f/${family.id}/members`}>Back to relatives</Link>
        </Button>
      </div>
    );
  }

  const deceased = member.livingStatus === 'DECEASED';
  const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);
  // The self-edit rule: your own record is always editable, whatever your role.
  const canEdit = can(Permission.MEMBER_UPDATE) || member.isYou;

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${member.displayName} from the tree? This can be undone.`)) return;
    await deleteMember.mutateAsync(member.id);
    void navigate(`/f/${family.id}/members`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Link
        to={`/f/${family.id}/members`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Relatives
      </Link>

      {/* A memorial header, not a record header. Photograph large, name in
          serif, the life dates immediately beneath. */}
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <MemberAvatar
          displayName={member.displayName}
          livingStatus={member.livingStatus}
          size="xl"
        />
        <div className="space-y-2">
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
            {member.displayName}
          </h1>
          {member.maidenName && (
            <p className="text-muted-foreground">née {member.maidenName}</p>
          )}
          <p className="flex flex-wrap items-center gap-x-3 text-lg text-muted-foreground">
            {lifeDates && <span className="tabular-nums">{lifeDates}</span>}
            {deceased && <span className="text-base">Remembered</span>}
            {member.isYou && <span className="text-base text-primary">This is you</span>}
          </p>
        </div>
      </header>

      <RelationshipToYou member={member} />
      {member.isRedacted && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-4">
          <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Details for living relatives are hidden from viewers in this family. Their name is
            shown, but their dates, biography and notes are not.
          </p>
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Fact label="Born" value={formatApproximateDate(member.birth)} />
        <Fact label="Place of birth" value={member.birthPlace} />
        {deceased && <Fact label="Died" value={formatApproximateDate(member.death)} />}
        {deceased && <Fact label="Place of death" value={member.deathPlace} />}
        <Fact label="Occupation" value={member.occupation} />
        <Fact label="Gender" value={member.gender} />
        {member.causeOfDeath && <Fact label="Cause of death" value={member.causeOfDeath} />}
      </dl>

      {member.biography && (
        <section className="space-y-3 border-t border-border/60 pt-8">
          <h2 className="font-serif text-xl tracking-tight">Their story</h2>
          <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-pretty">
            {member.biography}
          </p>
        </section>
      )}

      {member.notes && (
        <section className="space-y-2 border-t border-border/60 pt-8">
          <h2 className="font-serif text-lg tracking-tight">Notes</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {member.notes}
          </p>
        </section>
      )}

      <section className="border-t border-border/60 pt-8">

       <section className="max-w-md border-t border-border/60 pt-8">
        <RelationshipFinder anchor={member} />
      </section>
      
        <RelationsSection
          relations={relations}
          isPending={relationsPending}
          onAdd={setAddRelation}
        />
      </section>

      <section className="space-y-4 border-t border-border/60 pt-8">
        <p className="text-sm text-muted-foreground">
          The visual family tree arrives in Phase 8.
        </p>

        <div className="flex flex-wrap gap-3">
          {canEdit && (
            <Button asChild variant="outline">
              <Link to={`/f/${family.id}/members/${member.id}/edit`}>
                <Pencil aria-hidden />
                Edit
              </Link>
            </Button>
          )}

          {canEdit && !deceased && (
            <Button variant="ghost" onClick={() => setDeceasedOpen(true)}>
              Record that they have passed away
            </Button>
          )}

          {canEdit && deceased && (
            <Button
              variant="ghost"
              disabled={setLivingStatus.isPending}
              onClick={() => void setLivingStatus.mutateAsync({ livingStatus: 'LIVING' })}
            >
              {setLivingStatus.isPending && <Loader2 aria-hidden className="animate-spin" />}
              This was a mistake — they are living
            </Button>
          )}

          {!member.isYou && !deceased && (
            <Button
              variant="ghost"
              disabled={claim.isPending}
              onClick={() => void claim.mutateAsync()}
            >
              {claim.isPending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <UserCheck aria-hidden />
              )}
              This is me
            </Button>
          )}

          {can(Permission.MEMBER_DELETE) && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/5"
              disabled={deleteMember.isPending}
              onClick={() => void handleDelete()}
            >
              <Trash2 aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </section>

      <MarkDeceasedDialog
        member={member}
        familyId={family.id}
        open={deceasedOpen}
        onClose={() => setDeceasedOpen(false)}
      />

      <AddRelativeDialog
        anchor={member}
        familyId={family.id}
        relation={addRelation}
        onClose={() => setAddRelation(null)}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}