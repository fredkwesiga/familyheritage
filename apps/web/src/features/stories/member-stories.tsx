import { Link } from 'react-router-dom';
import { PenLine } from 'lucide-react';
import { formatApproximateDate, Permission, type Member } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import { ProvenanceBadge, VisibilityBadge } from './provenance';
import { useMemberStories } from './use-stories';

/** Stories about one person, on their profile. */
export function MemberStories({ member }: { member: Member }) {
  const { family, can } = useCurrentFamily();
  const { data: stories, isPending } = useMemberStories(family.id, member.id);

  const canWrite = can(Permission.STORY_CREATE);
  const firstName = member.displayName.split(' ')[0];

  if (isPending) return null;
  const items = stories ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl tracking-tight">Stories</h2>
        {canWrite && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/f/${family.id}/stories/new?member=${member.id}`}>
              <PenLine aria-hidden />
              Write one
            </Link>
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {canWrite
            ? `Nothing about ${firstName} has been written down yet. A few sentences is a start — the dates and photographs matter far less than what someone remembers.`
            : 'No stories yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((story) => {
            const when = formatApproximateDate(story.eventDate);
            return (
              <li key={story.id}>
                <Link
                  to={`/f/${family.id}/stories/${story.id}`}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-serif text-lg leading-snug tracking-tight">
                      {story.title}
                    </h3>
                    <div className="flex gap-2">
                      <ProvenanceBadge story={story} />
                      <VisibilityBadge story={story} />
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {story.body}
                  </p>
                  {when && (
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">{when}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}