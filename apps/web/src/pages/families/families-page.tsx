import { Link } from 'react-router-dom';
import { Loader2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFamilies } from '@/features/families/use-families';
import { ROLE_LABELS } from '@fh/shared';

export function FamiliesPage() {
  const { data: families, isPending } = useFamilies();

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The empty state is the most important screen in the product. A blank list
  // with an "Add" button is where family-tree apps die; this one says what the
  // next action is and why it is worth taking.
  if (!families || families.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-8 text-center">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl tracking-tight text-balance">
            Nothing has been written down yet
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            Start with the people you know, and the names, dates and stories can follow. Most
            families begin with three or four relatives and grow from there.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/families/new">
            <Plus aria-hidden />
            Start your family record
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Your families</h1>
          <p className="text-muted-foreground">
            {families.length === 1 ? 'One family record' : `${families.length} family records`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/families/new">
            <Plus aria-hidden />
            New family
          </Link>
        </Button>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {families.map((family) => (
          <li key={family.id}>
            <Link
              to={`/f/${family.id}`}
              className="block h-full rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <h2 className="font-serif text-xl tracking-tight">{family.name}</h2>
              {family.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {family.description}
                </p>
              )}
              <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users aria-hidden className="size-3.5" />
                  {family.memberCount === 0
                    ? 'No relatives yet'
                    : family.memberCount === 1
                      ? '1 relative'
                      : `${family.memberCount} relatives`}
                </span>
                <span className="uppercase tracking-wider">
                  {ROLE_LABELS[family.yourRole].label}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}