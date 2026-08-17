import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/features/auth/user-menu';
import { FamilyProvider } from '@/features/families/family-context';
import { useFamily } from '@/features/families/use-families';
import { cn } from '@/lib/utils';

/**
 * The shell for everything inside one family.
 *
 * Loads the family once, here, and puts it in context. Every page below can
 * then read the family and the user's role without another request, and
 * without prop-drilling familyId through six components.
 */
export function FamilyLayout() {
  const { familyId } = useParams<{ familyId: string }>();
  const { data: family, isPending, isError } = useFamily(familyId);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The API returns 404 both for "does not exist" and "not yours", so this one
  // screen is correct for both - and says nothing about which it was.
  if (isError || !family) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-4 text-center">
          <AlertTriangle aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h1 className="font-serif text-2xl tracking-tight">This family isn't available</h1>
          <p className="text-muted-foreground">
            It may have been removed, or you may no longer have access to it.
          </p>
          <Button asChild variant="outline">
            <Link to="/families">Back to your families</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FamilyProvider family={family}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="border-b border-border/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <Link
                to="/families"
                className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Family Heritage
              </Link>
              <h1 className="truncate font-serif text-lg tracking-tight">{family.name}</h1>
            </div>
            <UserMenu />
          </div>

          <nav className="mx-auto max-w-5xl px-6">
            <ul className="-mb-px flex gap-6 text-sm">
              <TabLink to={`/f/${family.id}`} end>
                Overview
              </TabLink>
              <TabLink to={`/f/${family.id}/members`}>Relatives</TabLink>
              <TabLink to={`/f/${family.id}/access`}>Access</TabLink>
              <TabLink to={`/f/${family.id}/settings`}>Settings</TabLink>
            </ul>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 md:py-14">
          <Outlet />
        </main>
      </div>
    </FamilyProvider>
  );
}

function TabLink({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'inline-block border-b-2 pb-3 transition-colors',
            isActive
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )
        }
      >
        {children}
      </NavLink>
    </li>
  );
}