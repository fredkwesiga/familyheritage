import {
  memberRelationsResponseSchema,
  memberSummarySchema,
  okResponseSchema,
    relationshipAnswerResponseSchema,
  type AddRelativeInput,
  type CreateParentChildInput,
  type CreatePartnershipInput,
  type MemberRelations,
  type MemberSummary,
  type UpdatePartnershipInput,
    type RelationshipAnswer,
} from '@fh/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

export const relationKeys = {
  of: (familyId: string, memberId: string) =>
    ['families', familyId, 'members', memberId, 'relations'] as const,
  between: (familyId: string, fromId: string, toId: string) =>
    ['families', familyId, 'relationship', fromId, toId] as const,
};

const addRelativeResponseSchema = z.object({ member: memberSummarySchema });

export async function getRelations(
  familyId: string,
  memberId: string,
): Promise<MemberRelations> {
  const { relations } = await apiRequest(
    `/families/${familyId}/members/${memberId}/relations`,
    memberRelationsResponseSchema,
  );
  return relations;
}

export async function addRelative(
  familyId: string,
  anchorId: string,
  body: AddRelativeInput,
): Promise<MemberSummary> {
  const { member } = await apiRequest(
    `/families/${familyId}/members/${anchorId}/relatives`,
    addRelativeResponseSchema,
    { method: 'POST', body },
  );
  return member;
}

export async function getRelationshipTo(
  familyId: string,
  fromMemberId: string,
  toMemberId: string,
): Promise<RelationshipAnswer> {
  const { relationship } = await apiRequest(
    `/families/${familyId}/members/${fromMemberId}/relationship-to/${toMemberId}`,
    relationshipAnswerResponseSchema,
  );
  return relationship;
}

export async function linkParentChild(
  familyId: string,
  body: CreateParentChildInput,
): Promise<void> {
  await apiRequest(`/families/${familyId}/relationships/parent-child`, okResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function unlinkParentChild(familyId: string, linkId: string): Promise<void> {
  await apiRequest(
    `/families/${familyId}/relationships/parent-child/${linkId}`,
    okResponseSchema,
    { method: 'DELETE' },
  );
}

export async function createPartnership(
  familyId: string,
  body: CreatePartnershipInput,
): Promise<void> {
  await apiRequest(`/families/${familyId}/relationships/partnerships`, okResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function updatePartnership(
  familyId: string,
  linkId: string,
  body: UpdatePartnershipInput,
): Promise<void> {
  await apiRequest(
    `/families/${familyId}/relationships/partnerships/${linkId}`,
    okResponseSchema,
    { method: 'PATCH', body },
  );
}

export async function deletePartnership(familyId: string, linkId: string): Promise<void> {
  await apiRequest(
    `/families/${familyId}/relationships/partnerships/${linkId}`,
    okResponseSchema,
    { method: 'DELETE' },
  );
}