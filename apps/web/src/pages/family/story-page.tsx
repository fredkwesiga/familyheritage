import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatApproximateDate } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import { MemberAvatar } from '@/features/members/member-avatar';
import {
  OriginalNotes,
  ProvenanceBadge,
  VisibilityBadge,
} from '@/features/stories/provenance';
import { useApproveStory, useDeleteStory, useStory } from '@/features/stories/use-stories';
import { ApiError } from '@/lib/api-client';

export function StoryPage() {
  const { family } = useCurrentFamily();
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { data: story, isPending, isError } = useStory(family.id, storyId);
  const approveStory = useApproveStory(family.id);
  const deleteStory = useDeleteStory(family.id);
  const [error, setError] = useState('');

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !story) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="font-serif text-2xl tracking-tight">This story isn't available</h1>
        <Button asChild variant="outline">
          <Link to={`/f/${family.id}/stories`}>Back to stories</Link>
        </Button>
      </div>
    );
  }

  const when = formatApproximateDate(story.eventDate);
  const isDraft = story.source === 'AI_ASSISTED_DRAFT';

  const remove = async () => {
    if (!window.confirm(`Remove "${story.title}"? It can be restored.`)) return;
    try {
      await deleteStory.mutateAsync(story.id);
      void navigate(`/f/${family.id}/stories`, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove it.');
    }
  };

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <Link
        to={`/f/${family.id}/stories`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Stories
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <ProvenanceBadge story={story} />
          <VisibilityBadge story={story} />
        </div>

        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
          {story.title}
        </h1>

        <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          {when && <span className="tabular-nums">{when}</span>}
          {story.place && <span>{story.place}</span>}
          {story.authorName && <span>Written by {story.authorName}</span>}
        </p>
      </header>

      <FormMessage>{error}</FormMessage>

      {/* A draft is invisible to the rest of the family until its author says
          otherwise. This banner is the only route out of that state. */}
      {isDraft && (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <p className="text-sm leading-relaxed text-pretty">
            Nobody else can see this yet. Read it through, change anything that is not right, and
            publish it when you are happy.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={approveStory.isPending}
              onClick={() => void approveStory.mutateAsync(story.id)}
            >
              {approveStory.isPending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Check aria-hidden />
              )}
              Publish to the family
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/f/${family.id}/stories/${story.id}/edit`}>Edit first</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Serif, generous line height, measured column. A family story should
          read like something worth reading, not like a database field. */}
      <div className="whitespace-pre-wrap font-serif text-lg leading-[1.75] text-pretty">
        {story.body}
      </div>

      <OriginalNotes story={story} />

      {story.subjects.length > 0 && (
        <section className="space-y-3 border-t border-border/60 pt-8">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">About</h2>
          <ul className="flex flex-wrap gap-3">
            {story.subjects.map((subject) => (
              <li key={subject.id}>
                <Link
                  to={`/f/${family.id}/members/${subject.id}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary/40"
                >
                  <MemberAvatar
                    memberId={subject.id}
                    displayName={subject.displayName}
                    livingStatus={subject.livingStatus}
                    size="sm"
                    className="size-8"
                  />
                  <span className="font-serif text-sm">{subject.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {story.canEdit && (
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-8">
          <Button asChild variant="outline">
            <Link to={`/f/${family.id}/stories/${story.id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/5"
            disabled={deleteStory.isPending}
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        </div>
      )}
    </article>
  );
}