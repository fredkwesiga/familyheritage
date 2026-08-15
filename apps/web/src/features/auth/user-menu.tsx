import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from './use-auth';

export function UserMenu() {
  const { user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  const handleSignOut = async () => {
    await logout.mutateAsync();
    void navigate('/login', { replace: true });
  };

  return (
    <div className="flex items-center gap-4">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {user.name ?? user.email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleSignOut()}
        disabled={logout.isPending}
      >
        <LogOut aria-hidden />
        <span className="sr-only sm:not-sr-only">Sign out</span>
      </Button>
    </div>
  );
}