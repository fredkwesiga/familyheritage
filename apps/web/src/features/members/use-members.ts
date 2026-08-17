import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMemberInput,
  MarkDeceasedInput,
  SetLivingStatusInput,
  UpdateMemberInput,
} from '@fh/shared';
import { familyKeys } from '@/features/families/api';
import { sessionQueryKey } from '@/features/auth/api';
import * as membersApi from './api';
import { memberKeys } from './api';

export function useMembers(familyId: string, includeDeleted = false) {
  return useQuery({
    queryKey: memberKeys.list(familyId, includeDeleted),
    queryFn: () => membersApi.listMembers(familyId, includeDeleted),
  });
}

export function useMember(familyId: string, memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.detail(familyId, memberId ?? 'none'),
    queryFn: () => membersApi.getMember(familyId, memberId as string),
    enabled: Boolean(memberId),
    retry: false,
  });
}

/**
 * Every mutation invalidates the member list AND the family, because the family
 * carries memberCount. Forgetting the second is how a counter goes stale and
 * quietly tells a family they have fewer relatives than they do.
 */
function useMemberInvalidation(familyId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: memberKeys.all(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.list() });
  };
}

export function useCreateMember(familyId: string) {
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (body: CreateMemberInput) => membersApi.createMember(familyId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateMember(familyId: string, memberId: string) {
  const queryClient = useQueryClient();
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (body: UpdateMemberInput) => membersApi.updateMember(familyId, memberId, body),
    onSuccess: (member) => {
      queryClient.setQueryData(memberKeys.detail(familyId, memberId), member);
      invalidate();
    },
  });
}

export function useMarkDeceased(familyId: string, memberId: string) {
  const queryClient = useQueryClient();
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (body: MarkDeceasedInput) => membersApi.markDeceased(familyId, memberId, body),
    onSuccess: (member) => {
      queryClient.setQueryData(memberKeys.detail(familyId, memberId), member);
      invalidate();
    },
  });
}

export function useSetLivingStatus(familyId: string, memberId: string) {
  const queryClient = useQueryClient();
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (body: SetLivingStatusInput) =>
      membersApi.setLivingStatus(familyId, memberId, body),
    onSuccess: (member) => {
      queryClient.setQueryData(memberKeys.detail(familyId, memberId), member);
      invalidate();
    },
  });
}

export function useClaimMember(familyId: string, memberId: string) {
  const queryClient = useQueryClient();
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: () => membersApi.claimMember(familyId, memberId),
    onSuccess: () => {
      // The claim lives on the membership, which /auth/me and the family both
      // report - a stale session would leave self-edit rights invisible.
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      invalidate();
    },
  });
}

export function useDeleteMember(familyId: string) {
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (memberId: string) => membersApi.deleteMember(familyId, memberId),
    onSuccess: invalidate,
  });
}

export function useRestoreMember(familyId: string) {
  const invalidate = useMemberInvalidation(familyId);
  return useMutation({
    mutationFn: (memberId: string) => membersApi.restoreMember(familyId, memberId),
    onSuccess: invalidate,
  });
}