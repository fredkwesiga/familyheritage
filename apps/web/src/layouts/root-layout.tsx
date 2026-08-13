import { Outlet } from 'react-router-dom';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-serif text-lg tracking-tight">Family Heritage</span>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">v0.1</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-20">
        <Outlet />
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          Preserving family history, one story at a time.
        </div>
      </footer>
    </div>
  );
}
