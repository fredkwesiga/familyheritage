import { Link } from 'react-router-dom';
import { Loader2, PenLine } from 'lucide-react';
import { Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { useCurrentFamily } from '@/features/families/family-context';
import { StoryCard } from '@/features/stories/story-card';
import { useStories } from '@/features/stories/use-stories';

export function StoriesPage() {
  const { family, can } = useCurrentFamily();
  const { data: stories, isPending } = useStories(family.id);

  const canWrite = can(Permission.STORY_CREATE);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = stories ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-8 text-center">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl tracking-tight text-balance">
            Names and dates are only half of it
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            What a family actually loses is the rest: what someone was like, what they said, why
            they moved. A few sentences now is worth more than a perfect record later.
          </p>
        </div>
        {canWrite && (
          <Button asChild size="lg">
            <Link to={`/f/${family.id}/stories/new`}>
              <PenLine aria-hidden />
              Write the first one
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
          <h1 className="font-serif text-3xl tracking-tight">Stories</h1>
          <p className="text-muted-foreground">
            {items.length === 1 ? 'One story' : `${items.length} stories`} recorded
          </p>
        </div>
        {canWrite && (
          <Button asChild variant="outline">
            <Link to={`/f/${family.id}/stories/new`}>
              <PenLine aria-hidden />
              Write a story
            </Link>
          </Button>
        )}
      </header>

      <ul className="space-y-4">
        {items.map((story) => (
          <li key={story.id}>
            <StoryCard story={story} familyId={family.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}