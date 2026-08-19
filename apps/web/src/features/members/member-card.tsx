import { Link } from 'react-router-dom';
import { formatLifeDates, type MemberSummary } from '@fh/shared';
import { cn } from '@/lib/utils';
import { MemberAvatar } from './member-avatar';

/**
 * The member card.
 *
 * Three signals distinguish someone who has died, and none of them is colour
 * alone: the life-dates line, a quiet "Remembered" label, and (from Phase 9) a
 * grayscale photograph. Grayscale on its own would be invisible to a screen
 * reader and meaningless on the many family photographs that are already black
 * and white.
 */
export function MemberCard({ member, to }: { member: MemberSummary; to: string }) {
  const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);
  const deceased = member.livingStatus === 'DECEASED';

  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors',
        'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <MemberAvatar
      memberId={member.id}
        displayName={member.displayName}
        livingStatus={member.livingStatus}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg leading-snug tracking-tight">
          {member.displayName}
          {member.maidenName && (
            <span className="text-muted-foreground"> (née {member.maidenName})</span>
          )}
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {lifeDates && <span className="tabular-nums">{lifeDates}</span>}
          {deceased && (
            <>
              {lifeDates && <span aria-hidden>·</span>}
              <span>Remembered</span>
            </>
          )}
          {member.isYou && (
            <>
              {(lifeDates || deceased) && <span aria-hidden>·</span>}
              <span className="text-primary">You</span>
            </>
          )}
        </p>
      </div>

      {member.deletedAt && (
        <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
          Removed
        </span>
      )}
    </Link>
  );
}