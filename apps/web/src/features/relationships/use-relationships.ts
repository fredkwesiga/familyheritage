import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddRelativeInput,
  CreatePartnershipInput,
  UpdatePartnershipInput,
} from '@fh/shared';
import { familyKeys } from '@/features/families/api';
import { memberKeys } from '@/features/members/api';
import * as relationsApi from './api';
import { relationKeys } from './api';

export function useRelations(familyId: string, memberId: string | undefined) {
  return useQuery({
    queryKey: relationKeys.of(familyId, memberId ?? 'none'),
    queryFn: () => relationsApi.getRelations(familyId, memberId as string),
    enabled: Boolean(memberId),
    retry: false,
  });
}

/**
 * A relationship change ripples further than the person you edited.
 *
 * Adding a parent changes that parent's children, every existing sibling's
 * sibling list, and the family's member count. Rather than track which of those
 * to touch, we drop the whole family's cached members and relations - at ten to
 * a hundred members that costs one small refetch and removes a whole class of
 * stale-data bugs.
 */
function useRelationInvalidation(familyId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['families', familyId, 'members'] });
    void queryClient.invalidateQueries({ queryKey: memberKeys.all(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.list() });
  };
}

export function useAddRelative(familyId: string, anchorId: string) {
  const invalidate = useRelationInvalidation(familyId);
  return useMutation({
    mutationFn: (body: AddRelativeInput) => relationsApi.addRelative(familyId, anchorId, body),
    onSuccess: invalidate,
  });
}

export function useUnlinkParentChild(familyId: string) {
  const invalidate = useRelationInvalidation(familyId);
  return useMutation({
    mutationFn: (linkId: string) => relationsApi.unlinkParentChild(familyId, linkId),
    onSuccess: invalidate,
  });
}

export function useCreatePartnership(familyId: string) {
  const invalidate = useRelationInvalidation(familyId);
  return useMutation({
    mutationFn: (body: CreatePartnershipInput) => relationsApi.createPartnership(familyId, body),
    onSuccess: invalidate,
  });
}

export function useUpdatePartnership(familyId: string) {
  const invalidate = useRelationInvalidation(familyId);
  return useMutation({
    mutationFn: (input: { linkId: string } & UpdatePartnershipInput) => {
      const { linkId, ...body } = input;
      return relationsApi.updatePartnership(familyId, linkId, body);
    },
    onSuccess: invalidate,
  });
}

export function useDeletePartnership(familyId: string) {
  const invalidate = useRelationInvalidation(familyId);
  return useMutation({
    mutationFn: (linkId: string) => relationsApi.deletePartnership(familyId, linkId),
    onSuccess: invalidate,
  });
}