import {
  okResponseSchema,
  storyListResponseSchema,
  storyResponseSchema,
  type CreateStoryInput,
  type Story,
  type UpdateStoryInput,
} from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const storyKeys = {
  all: (familyId: string) => ['families', familyId, 'stories'] as const,
  list: (familyId: string) => [...storyKeys.all(familyId), 'list'] as const,
  ofMember: (familyId: string, memberId: string) =>
    [...storyKeys.all(familyId), 'member', memberId] as const,
  detail: (familyId: string, storyId: string) =>
    [...storyKeys.all(familyId), 'detail', storyId] as const,
};

export async function listStories(familyId: string): Promise<Story[]> {
  const { stories } = await apiRequest(`/families/${familyId}/stories`, storyListResponseSchema);
  return stories;
}

export async function listMemberStories(
  familyId: string,
  memberId: string,
): Promise<Story[]> {
  const { stories } = await apiRequest(
    `/families/${familyId}/members/${memberId}/stories`,
    storyListResponseSchema,
  );
  return stories;
}

export async function getStory(familyId: string, storyId: string): Promise<Story> {
  const { story } = await apiRequest(
    `/families/${familyId}/stories/${storyId}`,
    storyResponseSchema,
  );
  return story;
}

export async function createStory(
  familyId: string,
  body: CreateStoryInput,
): Promise<Story> {
  const { story } = await apiRequest(`/families/${familyId}/stories`, storyResponseSchema, {
    method: 'POST',
    body,
  });
  return story;
}

export async function updateStory(
  familyId: string,
  storyId: string,
  body: UpdateStoryInput,
): Promise<Story> {
  const { story } = await apiRequest(
    `/families/${familyId}/stories/${storyId}`,
    storyResponseSchema,
    { method: 'PATCH', body },
  );
  return story;
}

export async function approveStory(familyId: string, storyId: string): Promise<Story> {
  const { story } = await apiRequest(
    `/families/${familyId}/stories/${storyId}/approve`,
    storyResponseSchema,
    { method: 'POST' },
  );
  return story;
}

export async function deleteStory(familyId: string, storyId: string): Promise<void> {
  await apiRequest(`/families/${familyId}/stories/${storyId}`, okResponseSchema, {
    method: 'DELETE',
  });
}