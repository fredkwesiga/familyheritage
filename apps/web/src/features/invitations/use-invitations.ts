import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateInvitationInput } from '@fh/shared';
import { familyKeys } from '@/features/families/api';
import { sessionQueryKey } from '@/features/auth/api';
import * as invitationsApi from './api';
import { invitationKeys } from './api';

export function usePendingInvitations(familyId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationKeys.pending(familyId),
    queryFn: () => invitationsApi.listInvitations(familyId),
    enabled,
  });
}

export function useCreateInvitation(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvitationInput) =>
      invitationsApi.createInvitation(familyId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationKeys.pending(familyId) });
    },
  });
}

export function useRevokeInvitation(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      invitationsApi.revokeInvitation(familyId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationKeys.pending(familyId) });
    },
  });
}

/**
 * Public preview of an invitation.
 *
 * No retry: a token is either good or it is not, and retrying a bad one just
 * makes an already-disappointing screen slower to arrive.
 */
export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: invitationKeys.preview(token ?? 'none'),
    queryFn: () => invitationsApi.previewInvitation(token as string),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => invitationsApi.acceptInvitation(token),
    onSuccess: () => {
      // The user now belongs to a family they did not a moment ago, and both
      // the session and the family list carry that.
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      void queryClient.invalidateQueries({ queryKey: familyKeys.list() });
    },
  });
}