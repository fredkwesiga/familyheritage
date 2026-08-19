import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStoryInput, UpdateStoryInput } from '@fh/shared';
import * as storiesApi from './api';
import { storyKeys } from './api';

export function useStories(familyId: string) {
  return useQuery({
    queryKey: storyKeys.list(familyId),
    queryFn: () => storiesApi.listStories(familyId),
  });
}

export function useMemberStories(familyId: string, memberId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.ofMember(familyId, memberId ?? 'none'),
    queryFn: () => storiesApi.listMemberStories(familyId, memberId as string),
    enabled: Boolean(memberId),
  });
}

export function useStory(familyId: string, storyId: string | undefined) {
  return useQuery({
    queryKey: storyKeys.detail(familyId, storyId ?? 'none'),
    queryFn: () => storiesApi.getStory(familyId, storyId as string),
    enabled: Boolean(storyId),
    retry: false,
  });
}

function useStoryInvalidation(familyId: string) {
  const queryClient = useQueryClient();
  // A story can be tagged to several people, and retagging moves it between
  // their lists, so the whole family's story cache goes rather than a subset.
  return () => queryClient.invalidateQueries({ queryKey: storyKeys.all(familyId) });
}

export function useCreateStory(familyId: string) {
  const invalidate = useStoryInvalidation(familyId);
  return useMutation({
    mutationFn: (body: CreateStoryInput) => storiesApi.createStory(familyId, body),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateStory(familyId: string, storyId: string) {
  const invalidate = useStoryInvalidation(familyId);
  return useMutation({
    mutationFn: (body: UpdateStoryInput) => storiesApi.updateStory(familyId, storyId, body),
    onSuccess: () => void invalidate(),
  });
}

export function useApproveStory(familyId: string) {
  const invalidate = useStoryInvalidation(familyId);
  return useMutation({
    mutationFn: (storyId: string) => storiesApi.approveStory(familyId, storyId),
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteStory(familyId: string) {
  const invalidate = useStoryInvalidation(familyId);
  return useMutation({
    mutationFn: (storyId: string) => storiesApi.deleteStory(familyId, storyId),
    onSuccess: () => void invalidate(),
  });
}