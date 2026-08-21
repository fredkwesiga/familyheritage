import {
  familyListResponseSchema,
  familyResponseSchema,
  familyAccessListSchema,
  okResponseSchema,
  type ChangeRoleInput,
  type CreateFamilyInput,
  type Family,
  type FamilyAccessEntry,
  type FamilySummary,
  type UpdateFamilyInput,
} from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const familyKeys = {
  all: ['families'] as const,
  list: () => [...familyKeys.all, 'list'] as const,
  detail: (familyId: string) => [...familyKeys.all, 'detail', familyId] as const,
  access: (familyId: string) => [...familyKeys.all, 'access', familyId] as const,
};

export async function listFamilies(): Promise<FamilySummary[]> {
  const { families } = await apiRequest('/families', familyListResponseSchema);
  return families;
}

export async function getFamily(familyId: string): Promise<Family> {
  const { family } = await apiRequest(`/families/${familyId}`, familyResponseSchema);
  return family;
}

export async function createFamily(body: CreateFamilyInput): Promise<Family> {
  const { family } = await apiRequest('/families', familyResponseSchema, {
    method: 'POST',
    body,
  });
  return family;
}

export async function updateFamily(
  familyId: string,
  body: UpdateFamilyInput,
): Promise<Family> {
  const { family } = await apiRequest(`/families/${familyId}`, familyResponseSchema, {
    method: 'PATCH',
    body,
  });
  return family;
}


export async function deleteFamily(familyId: string, confirmFamilyName: string): Promise<void> {
  // The API requires the family's name in the body, and checks it against the
  // record. The typed confirmation is a server-side rule, not a UI nicety -
  // which is the right way round.
  await apiRequest(`/families/${familyId}`, okResponseSchema, {
    method: 'DELETE',
    body: { confirmFamilyName },
  });
}

export async function listAccess(familyId: string): Promise<FamilyAccessEntry[]> {
  const { access } = await apiRequest(`/families/${familyId}/access`, familyAccessListSchema);
  return access;
}

export async function changeRole(
  familyId: string,
  userId: string,
  body: ChangeRoleInput,
): Promise<void> {
  await apiRequest(`/families/${familyId}/access/${userId}`, okResponseSchema, {
    method: 'PATCH',
    body,
  });
}

export async function revokeAccess(familyId: string, userId: string): Promise<void> {
  await apiRequest(`/families/${familyId}/access/${userId}`, okResponseSchema, {
    method: 'DELETE',
  });
}