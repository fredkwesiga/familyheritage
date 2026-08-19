import { Lock, Sparkles } from 'lucide-react';
import type { Story } from '@fh/shared';

/**
 * How a story came to exist, stated plainly.
 *
 * Built before any AI exists, and shown on every assisted story from the moment
 * one is created. A family reading this in twenty years is entitled to know
 * whether their grandmother wrote these words or a machine arranged them, and
 * that distinction cannot be reconstructed after the fact - only recorded at
 * the time and carried forward.
 */
export function ProvenanceBadge({ story }: { story: Story }) {
  if (story.source === 'HUMAN') return null;

  const isDraft = story.source === 'AI_ASSISTED_DRAFT';

  return (
    <span
      className={
        isDraft
          ? 'inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-2.5 py-1 text-xs text-accent'
          : 'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground'
      }
    >
      <Sparkles aria-hidden className="size-3" />
      {isDraft ? 'Draft — only you can see this' : 'Written with help'}
    </span>
  );
}

export function VisibilityBadge({ story }: { story: Story }) {
  if (story.visibility !== 'ADMINS_ONLY') return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
      <Lock aria-hidden className="size-3" />
      Admins only
    </span>
  );
}

/**
 * The notes an assisted story was built from.
 *
 * Kept verbatim and shown alongside the result, so what someone actually said
 * is never replaced by a tidier version of it.
 */
export function OriginalNotes({ story }: { story: Story }) {
  if (!story.originalNotes) return null;

  return (
    <details className="rounded-lg border border-border bg-secondary/40 p-4">
      <summary className="cursor-pointer text-sm font-medium">
        The notes this was written from
      </summary>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {story.originalNotes}
      </p>
    </details>
  );
}