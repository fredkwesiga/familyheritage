import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangeRoleInput, UpdateFamilyInput } from '@fh/shared';
import { sessionQueryKey } from '@/features/auth/api';
import * as familiesApi from './api';
import { familyKeys } from './api';

export function useFamilies() {
  return useQuery({
    queryKey: familyKeys.list(),
    queryFn: familiesApi.listFamilies,
  });
}

export function useFamily(familyId: string | undefined) {
  return useQuery({
    queryKey: familyKeys.detail(familyId ?? 'none'),
    queryFn: () => familiesApi.getFamily(familyId as string),
    enabled: Boolean(familyId),
    // A 404 here means "not yours", not "try again" - retrying just delays the
    // not-found screen by a couple of seconds.
    retry: false,
  });
}

export function useCreateFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familiesApi.createFamily,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familyKeys.list() });
      // /auth/me carries the user's families, so it is now stale too.
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });
}

export function useUpdateFamily(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFamilyInput) => familiesApi.updateFamily(familyId, body),
    onSuccess: (family) => {
      queryClient.setQueryData(familyKeys.detail(familyId), family);
      void queryClient.invalidateQueries({ queryKey: familyKeys.list() });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });
}

export function useFamilyAccess(familyId: string) {
  return useQuery({
    queryKey: familyKeys.access(familyId),
    queryFn: () => familiesApi.listAccess(familyId),
  });
}

export function useChangeRole(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string } & ChangeRoleInput) =>
      familiesApi.changeRole(familyId, input.userId, { role: input.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familyKeys.access(familyId) });
    },
  });
}

export function useRevokeAccess(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => familiesApi.revokeAccess(familyId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familyKeys.access(familyId) });
    },
  });
}