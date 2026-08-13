import { ConnectionStatus } from '@/features/health/connection-status';

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phase 1</p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance md:text-5xl">
          The foundation is in place.
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
          Frontend, API and database are connected. Next we give this family a name, and then we
          give it people.
        </p>
      </section>

      <ConnectionStatus />
    </div>
  );
}
