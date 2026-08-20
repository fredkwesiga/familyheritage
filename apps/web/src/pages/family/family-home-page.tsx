import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Permission } from '@fh/shared';
import { useCurrentFamily } from '@/features/families/family-context';
import { OnboardingInvitation } from './onboarding-page';

export function FamilyHomePage() {
  const { family, can } = useCurrentFamily();

  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-3">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
          {family.name}
        </h1>
        {family.description && (
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {family.description}
          </p>
        )}
      </section>

      {family.memberCount === 0 && can(Permission.MEMBER_CREATE) ? (
        <OnboardingInvitation familyId={family.id} />
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Users aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 font-serif text-xl tracking-tight">
            {family.memberCount === 0
              ? 'No relatives recorded yet'
              : `${family.memberCount} relatives recorded`}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-pretty">
            {can(Permission.MEMBER_CREATE)
              ? 'Start with anyone — yourself, a parent, a grandparent. A name is enough.'
              : 'Your role lets you read this family record. Ask an admin if you need to add to it.'}
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link to={`/f/${family.id}/members`}>View relatives</Link>
          </Button>
        </section>
      )}

      <section className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border/60 pt-6 text-sm text-muted-foreground">
        <span>
          Living relatives{' '}
          <span className="text-foreground">
            {family.hideLivingFromViewers ? 'hidden from viewers' : 'visible to everyone'}
          </span>
        </span>
        <span>
          AI assistance <span className="text-foreground">{family.aiEnabled ? 'on' : 'off'}</span>
        </span>
        {can(Permission.FAMILY_UPDATE) && (
          <Link
            to={`/f/${family.id}/settings`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Change
          </Link>
        )}
      </section>
    </div>
  );
}