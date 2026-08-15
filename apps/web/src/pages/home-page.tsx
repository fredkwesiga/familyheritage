import { ConnectionStatus } from '@/features/health/connection-status';
import { useSession } from '@/features/auth/use-auth';

export function HomePage() {
  const { user } = useSession();

  const greeting = user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Welcome';

  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phase 3</p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance md:text-5xl">
          {greeting}.
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
          {user && user.families.length === 0
            ? "You haven't started a family record yet. That comes next — Phase 4 adds families, and Phase 5 adds the people in them."
            : 'Your families are ready. Choose one to continue.'}
        </p>
      </section>

      {user && user.families.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl tracking-tight">Your families</h2>
          <ul className="space-y-2">
            {user.families.map((family) => (
              <li
                key={family.familyId}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="font-serif">{family.name}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {family.role.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConnectionStatus />
    </div>
  );
}