import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './use-auth';

/**
 * Route wrapper. Renders nothing decisive until the session is known.
 *
 * The three states have to stay distinct: unknown, signed in, signed out.
 * Collapsing "unknown" into "signed out" bounces a returning user to the login
 * page for a fraction of a second on every reload - and on a slow connection,
 * for considerably longer than that.
 */
export function RequireAuth() {
  const { isAuthenticated, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // `from` is carried so the login page can return the user to where they
    // were heading, rather than dumping everyone on the home page.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/** The inverse: keeps a signed-in user off the login and register pages. */
export function RedirectIfAuthenticated() {
  const { isAuthenticated, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
}