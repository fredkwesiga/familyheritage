import {
  memberListResponseSchema,
  memberResponseSchema,
  okResponseSchema,
  type CreateMemberInput,
  type MarkDeceasedInput,
  type Member,
  type MemberListResponse,
  type SetLivingStatusInput,
  type UpdateMemberInput,
} from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const memberKeys = {
  all: (familyId: string) => ['families', familyId, 'members'] as const,
  list: (familyId: string, includeDeleted = false) =>
    [...memberKeys.all(familyId), 'list', { includeDeleted }] as const,
  detail: (familyId: string, memberId: string) =>
    [...memberKeys.all(familyId), 'detail', memberId] as const,
};

const base = (familyId: string) => `/families/${familyId}/members`;

export function listMembers(
  familyId: string,
  includeDeleted = false,
): Promise<MemberListResponse> {
  const query = includeDeleted ? '?includeDeleted=true' : '';
  return apiRequest(`${base(familyId)}${query}`, memberListResponseSchema);
}

export async function getMember(familyId: string, memberId: string): Promise<Member> {
  const { member } = await apiRequest(`${base(familyId)}/${memberId}`, memberResponseSchema);
  return member;
}

export async function createMember(
  familyId: string,
  body: CreateMemberInput,
): Promise<Member> {
  const { member } = await apiRequest(base(familyId), memberResponseSchema, {
    method: 'POST',
    body,
  });
  return member;
}

export async function updateMember(
  familyId: string,
  memberId: string,
  body: UpdateMemberInput,
): Promise<Member> {
  const { member } = await apiRequest(`${base(familyId)}/${memberId}`, memberResponseSchema, {
    method: 'PATCH',
    body,
  });
  return member;
}

export async function markDeceased(
  familyId: string,
  memberId: string,
  body: MarkDeceasedInput,
): Promise<Member> {
  const { member } = await apiRequest(
    `${base(familyId)}/${memberId}/deceased`,
    memberResponseSchema,
    { method: 'POST', body },
  );
  return member;
}

export async function setLivingStatus(
  familyId: string,
  memberId: string,
  body: SetLivingStatusInput,
): Promise<Member> {
  const { member } = await apiRequest(
    `${base(familyId)}/${memberId}/living-status`,
    memberResponseSchema,
    { method: 'POST', body },
  );
  return member;
}

export async function claimMember(familyId: string, memberId: string): Promise<Member> {
  const { member } = await apiRequest(
    `${base(familyId)}/${memberId}/claim`,
    memberResponseSchema,
    { method: 'POST' },
  );
  return member;
}

export async function deleteMember(familyId: string, memberId: string): Promise<void> {
  await apiRequest(`${base(familyId)}/${memberId}`, okResponseSchema, { method: 'DELETE' });
}

export async function restoreMember(familyId: string, memberId: string): Promise<Member> {
  const { member } = await apiRequest(
    `${base(familyId)}/${memberId}/restore`,
    memberResponseSchema,
    { method: 'POST' },
  );
  return member;
}