import { Link } from 'react-router-dom';
import { formatApproximateDate, type Story } from '@fh/shared';
import { ProvenanceBadge, VisibilityBadge } from './provenance';

/** A story in a list. Enough to decide whether to read it, and no more. */
export function StoryCard({ story, familyId }: { story: Story; familyId: string }) {
  const when = formatApproximateDate(story.eventDate);
  const about = story.subjects.map((subject) => subject.displayName).join(', ');

  return (
    <Link
      to={`/f/${familyId}/stories/${story.id}`}
      className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-serif text-xl leading-snug tracking-tight text-balance">
          {story.title}
        </h3>
        <div className="flex shrink-0 gap-2">
          <ProvenanceBadge story={story} />
          <VisibilityBadge story={story} />
        </div>
      </div>

      {/* Three lines of the story itself, which tells a reader far more about
          whether they want it than any metadata would. */}
      <p className="mt-2 line-clamp-3 leading-relaxed text-muted-foreground text-pretty">
        {story.body}
      </p>

      <p className="mt-4 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {about && <span>About {about}</span>}
        {when && <span className="tabular-nums">{when}</span>}
        {story.place && <span>{story.place}</span>}
        {story.authorName && <span>Written by {story.authorName}</span>}
      </p>
    </Link>
  );
}