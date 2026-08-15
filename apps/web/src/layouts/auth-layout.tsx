import { Link, Outlet } from 'react-router-dom';

/**
 * The shell for every page a signed-out visitor sees.
 *
 * Deliberately not a bordered card floating on grey. The first impression of a
 * product about family history should not be a login form from an admin panel.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 py-8">
        <Link
          to="/"
          className="font-serif text-lg tracking-tight text-foreground/80 transition-colors hover:text-foreground"
        >
          Family Heritage
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        Preserving family history, one story at a time.
      </footer>
    </div>
  );
}