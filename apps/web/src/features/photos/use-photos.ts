import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePhotoInput } from '@fh/shared';
import { memberKeys } from '@/features/members/api';
import * as photosApi from './api';
import { photoKeys } from './api';

export function usePhotos(familyId: string) {
  return useQuery({
    queryKey: photoKeys.list(familyId),
    queryFn: () => photosApi.listPhotos(familyId),
  });
}

export function useMemberPhotos(familyId: string, memberId: string | undefined) {
  return useQuery({
    queryKey: photoKeys.ofMember(familyId, memberId ?? 'none'),
    queryFn: () => photosApi.listMemberPhotos(familyId, memberId as string),
    enabled: Boolean(memberId),
  });
}

/**
 * Every member's profile picture in one lookup.
 *
 * Called by MemberAvatar itself. React Query deduplicates by key, so a list of
 * forty relatives makes exactly one request no matter how many avatars are on
 * screen - and no component in between has to know that photographs exist.
 *
 * Signed URLs are stable, so this is cached for the session.
 */
export function useMemberAvatars(familyId: string) {
  return useQuery({
    queryKey: photoKeys.avatars(familyId),
    queryFn: () => photosApi.getMemberAvatars(familyId),
    staleTime: 10 * 60 * 1000,
    // Photographs are optional; a failure here must never break a member list.
    retry: false,
  });
}

function usePhotoInvalidation(familyId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: photoKeys.all(familyId) });
    void queryClient.invalidateQueries({ queryKey: memberKeys.all(familyId) });
  };
}

export function useConfirmPhoto(familyId: string) {
  const invalidate = usePhotoInvalidation(familyId);
  return useMutation({
    mutationFn: (body: Parameters<typeof photosApi.confirmPhoto>[1]) =>
      photosApi.confirmPhoto(familyId, body),
    onSuccess: invalidate,
  });
}

export function useUpdatePhoto(familyId: string) {
  const invalidate = usePhotoInvalidation(familyId);
  return useMutation({
    mutationFn: (input: { photoId: string } & UpdatePhotoInput) => {
      const { photoId, ...body } = input;
      return photosApi.updatePhoto(familyId, photoId, body);
    },
    onSuccess: invalidate,
  });
}

export function useSetPrimaryPhoto(familyId: string) {
  const invalidate = usePhotoInvalidation(familyId);
  return useMutation({
    mutationFn: (input: { memberId: string; photoId: string | null }) =>
      photosApi.setPrimaryPhoto(familyId, input.memberId, input.photoId),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto(familyId: string) {
  const invalidate = usePhotoInvalidation(familyId);
  return useMutation({
    mutationFn: (photoId: string) => photosApi.deletePhoto(familyId, photoId),
    onSuccess: invalidate,
  });
}