import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import {
  ConnectionPicker,
  EMPTY_CONNECTION,
  type Connection,
} from '@/features/members/connection-picker';
import { MemberForm, orNull, type MemberFormValues } from '@/features/members/member-form';
import { useCreateMember, useMembers } from '@/features/members/use-members';
import { addRelative, linkParentChild } from '@/features/relationships/api';
import { ApiError } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

export function MemberNewPage() {
  const { family } = useCurrentFamily();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMember = useCreateMember(family.id);
  const { data: memberData } = useMembers(family.id);

  const [connection, setConnection] = useState<Connection>(EMPTY_CONNECTION);
  const [error, setError] = useState('');

  const members = memberData?.members ?? [];

  /**
   * Creating a person and connecting them is one action, not two.
   *
   * Adding someone from this page used to leave them floating - a name in a
   * list with no place in the tree - and connecting them afterwards was a
   * separate journey most people never made. A record full of unconnected
   * people is the failure this page exists to prevent.
   */
  const handleSubmit = async (values: MemberFormValues) => {
    setError('');

    const person = {
      givenName: orNull(values.givenName) ?? undefined,
      familyName: orNull(values.familyName) ?? undefined,
      otherNames: orNull(values.otherNames) ?? undefined,
      maidenName: orNull(values.maidenName) ?? undefined,
      gender: orNull(values.gender) ?? undefined,
      livingStatus: values.livingStatus,
      birth: values.birth,
      birthPlace: orNull(values.birthPlace) ?? undefined,
      occupation: orNull(values.occupation) ?? undefined,
      biography: orNull(values.biography) ?? undefined,
      notes: orNull(values.notes) ?? undefined,
    };

    try {
      // No connection chosen, or nobody to connect to yet: the plain path.
      if (connection.relation === 'NONE' || !connection.anchorId) {
        const created = await createMember.mutateAsync(person);
        void navigate(`/f/${family.id}/members/${created.id}`, { replace: true });
        return;
      }

      // The person and the link are created together, so a half-finished
      // record cannot be left behind by someone closing the tab.
      const created = await addRelative(family.id, connection.anchorId, {
        relation: connection.relation,
        member: person,
        relationType: connection.relationType,
      });

      if (connection.relation === 'CHILD' && connection.otherParentId) {
        await linkParentChild(family.id, {
          parentId: connection.otherParentId,
          childId: created.id,
          relationType: connection.relationType,
        });
      }

      void queryClient.invalidateQueries({ queryKey: ['families', family.id] });
      void navigate(`/f/${family.id}/members/${created.id}`, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not add that person.',
      );
      // Rethrown so the form knows the submission failed and stays put.
      throw caught;
    }
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
        <h1 className="font-serif text-3xl tracking-tight">Add someone</h1>
        <p className="text-muted-foreground text-pretty">
          {members.length === 0
            ? 'The first person in the tree. Everyone else will connect to them, or to each other.'
            : 'A name is enough to start. What matters most is saying how they connect.'}
        </p>
      </header>

      <FormMessage>{error}</FormMessage>

      {/* Above the details, deliberately. The connection is the part people
          skip, and putting it after a long form guarantees they will. */}
      <ConnectionPicker members={members} value={connection} onChange={setConnection} />

      <MemberForm
        submitLabel="Add to the family"
        showLivingStatus
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/f/${family.id}/members`)}
      />
    </div>
  );
}