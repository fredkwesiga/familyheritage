import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md space-y-4">
        <h1 className="font-serif text-3xl tracking-tight">This page does not exist.</h1>
        <p className="text-muted-foreground">The link may be old, or the page may have moved.</p>
        <Button asChild variant="outline">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}