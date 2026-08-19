import { formatLifeDates, type MemberSummary } from '@fh/shared';
import { MemberAvatar } from '@/features/members/member-avatar';
import { cn } from '@/lib/utils';

/**
 * One person in the tree.
 *
 * Deliberately small and quiet: the tree's job is to show shape, and a card
 * carrying six fields turns a family into a spreadsheet. Name, life dates, and
 * a photograph. Everything else is a tap away on the profile.
 */
export function TreeNodeCard({
  member,
  onSelect,
  isFocus,
  note,
  size = 'md',
}: {
  member: MemberSummary;
  onSelect: (memberId: string) => void;
  isFocus?: boolean;
  note?: string;
  size?: 'sm' | 'md';
}) {
  const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);
  const deceased = member.livingStatus === 'DECEASED';

  return (
    <button
      type="button"
      onClick={() => onSelect(member.id)}
      aria-current={isFocus ? 'true' : undefined}
      className={cn(
        'flex w-full flex-col items-center gap-2 rounded-xl border bg-card px-3 text-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'md' ? 'py-4' : 'py-3',
        isFocus
          ? 'border-primary/60 bg-primary/5 shadow-[0_0_0_3px_rgba(0,0,0,0.02)]'
          : 'border-border hover:border-primary/40',
      )}
    >
      <MemberAvatar
      memberId={member.id}
        displayName={member.displayName}
        livingStatus={member.livingStatus}
        size={size === 'md' ? 'md' : 'sm'}
      />
      <span className="min-w-0 space-y-0.5">
        <span
          className={cn(
            'block truncate font-serif leading-snug tracking-tight',
            size === 'md' ? 'text-base' : 'text-sm',
          )}
        >
          {member.displayName}
        </span>
        {/* The life-dates line is how someone who has died is recognised. It
            works where colour cannot: in a screen reader, and on the many family
            photographs that were already black and white. */}
        {(lifeDates || note) && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">
            {[lifeDates, note].filter(Boolean).join(' · ')}
          </span>
        )}
        {deceased && <span className="sr-only">Deceased</span>}
      </span>
    </button>
  );
}