import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCurrentFamily } from '@/features/families/family-context';
import {
  MemberForm,
  memberToFormValues,
  orNull,
  type MemberFormValues,
} from '@/features/members/member-form';
import { useMember, useUpdateMember } from '@/features/members/use-members';

export function MemberEditPage() {
  const { family } = useCurrentFamily();
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { data: member, isPending } = useMember(family.id, memberId);
  const updateMember = useUpdateMember(family.id, memberId ?? '');

  if (isPending || !member) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (values: MemberFormValues) => {
    await updateMember.mutateAsync({
      givenName: orNull(values.givenName),
      familyName: orNull(values.familyName),
      otherNames: orNull(values.otherNames),
      maidenName: orNull(values.maidenName),
      gender: orNull(values.gender),
      birth: values.birth,
      birthPlace: orNull(values.birthPlace),
      occupation: orNull(values.occupation),
      biography: orNull(values.biography),
      notes: orNull(values.notes),
    });
    void navigate(`/f/${family.id}/members/${member.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        to={`/f/${family.id}/members/${member.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {member.displayName}
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Edit {member.displayName}</h1>
        {/* Living status is changed through its own flow, not a dropdown here -
            it is a meaningful, audited event, not a field edit. */}
        <p className="text-muted-foreground">
          To record that someone has passed away, use the option on their profile.
        </p>
      </header>

      <MemberForm
        defaultValues={memberToFormValues(member)}
        submitLabel="Save changes"
        showLivingStatus={false}
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/f/${family.id}/members/${member.id}`)}
      />
    </div>
  );
}