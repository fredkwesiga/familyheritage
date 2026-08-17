import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCurrentFamily } from '@/features/families/family-context';
import { MemberForm, type MemberFormValues } from '@/features/members/member-form';
import { useCreateMember } from '@/features/members/use-members';

export function MemberNewPage() {
  const { family } = useCurrentFamily();
  const navigate = useNavigate();
  const createMember = useCreateMember(family.id);

  const handleSubmit = async (values: MemberFormValues) => {
    const member = await createMember.mutateAsync({
      givenName: values.givenName || undefined,
      familyName: values.familyName || undefined,
      otherNames: values.otherNames || undefined,
      maidenName: values.maidenName || undefined,
      gender: values.gender || undefined,
      livingStatus: values.livingStatus,
      birth: values.birth,
      birthPlace: values.birthPlace || undefined,
      occupation: values.occupation || undefined,
      biography: values.biography || undefined,
      notes: values.notes || undefined,
    });
    void navigate(`/f/${family.id}/members/${member.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        to={`/f/${family.id}/members`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Relatives
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Add a person</h1>
        <p className="text-muted-foreground text-pretty">
          Only a name is needed. Leave anything you are unsure of blank — an empty field is more
          honest than a guess, and it can be filled in whenever someone remembers.
        </p>
      </header>

      <MemberForm
        submitLabel="Add to the family"
        showLivingStatus
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/f/${family.id}/members`)}
      />
    </div>
  );
}