import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Network, User } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import { FocusView } from '@/features/tree/focus-view';
import { useTree } from '@/features/tree/use-tree';
import { cn } from '@/lib/utils';

/**
 * React Flow is around 300 KB, and most visits never leave the focus view - so
 * it is fetched only when someone actually asks for the whole tree. That keeps
 * the first load light, which matters most on the slow connections this product
 * is likely to meet.
 */
const CanvasView = lazy(() =>
  import('@/features/tree/canvas-view').then((module) => ({ default: module.CanvasView })),
);

type ViewMode = 'focus' | 'canvas';

export function TreePage() {
  const { family } = useCurrentFamily();
  const { tree, isPending } = useTree(family.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [focusId, setFocusId] = useState<string | null>(searchParams.get('focus'));
  const [view, setView] = useState<ViewMode>(
    searchParams.get('view') === 'canvas' ? 'canvas' : 'focus',
  );
  const [depth, setDepth] = useState(2);

  // Start from the reader's own record when they have claimed one. Landing on
  // yourself is what makes the tree immediately legible - every other person is
  // then somewhere relative to you.
  useEffect(() => {
    if (focusId || !tree?.suggestedRootId) return;
    setFocusId(tree.suggestedRootId);
  }, [focusId, tree?.suggestedRootId]);

  const updateUrl = (next: { focus?: string; view?: ViewMode }) => {
    const params = new URLSearchParams(searchParams);
    if (next.focus) params.set('focus', next.focus);
    if (next.view) params.set('view', next.view);
    setSearchParams(params, { replace: true });
  };

  const focus = (memberId: string) => {
    setFocusId(memberId);
    // In the URL so the view survives a reload and can be shared with a
    // relative: "look at this person".
    updateUrl({ focus: memberId });
  };

  const changeView = (next: ViewMode) => {
    setView(next);
    updateUrl({ view: next });
  };

  if (isPending) {
    return (
      <div className="flex justify-center py-20">
        <Loader2
          aria-label="Loading the family tree"
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  if (!tree || tree.members.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16 text-center">
        <h1 className="font-serif text-2xl tracking-tight">Nothing to draw yet</h1>
        <p className="text-muted-foreground text-pretty">
          Add a few relatives and the tree will take shape around them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl tracking-tight">Family tree</h1>
            <p className="text-muted-foreground">
              Choose anyone to see the people around them.
            </p>
          </div>

          <div className="w-56">
            <FormField label="Centre on" htmlFor="tree-focus">
              <Select
                id="tree-focus"
                value={focusId ?? ''}
                onChange={(event) => focus(event.target.value)}
              >
                {tree.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Focus is listed first and is the default. The canvas is the
              addition for people who want the whole shape at once - not the
              other way round. */}
          <div role="radiogroup" aria-label="How to show the tree" className="flex gap-1.5">
            <ViewButton
              active={view === 'focus'}
              onClick={() => changeView('focus')}
              icon={<User aria-hidden className="size-3.5" />}
              label="One person at a time"
            />
            <ViewButton
              active={view === 'canvas'}
              onClick={() => changeView('canvas')}
              icon={<Network aria-hidden className="size-3.5" />}
              label="Whole tree"
            />
          </div>

          {view === 'canvas' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Generations
              <select
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="rounded-md border border-input bg-card px-2 py-1 text-sm"
              >
                <option value={1}>1 each way</option>
                <option value={2}>2 each way</option>
                <option value={3}>3 each way</option>
                <option value={4}>4 each way</option>
              </select>
            </label>
          )}
        </div>
      </header>

      {focusId && view === 'focus' && (
        <FocusView tree={tree} focusId={focusId} onFocus={focus} />
      )}

      {focusId && view === 'canvas' && (
        <Suspense
          fallback={
            <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border border-border">
              <Loader2 aria-label="Loading the canvas" className="animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CanvasView tree={tree} focusId={focusId} onFocus={focus} depth={depth} />
        </Suspense>
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
      )}
    >
      {icon}
      {label}
    </button>
  );
}