import {
  acceptInvitationResponseSchema,
  invitationListResponseSchema,
  invitationPreviewResponseSchema,
  invitationResponseSchema,
  okResponseSchema,
  type AcceptInvitationResponse,
  type CreateInvitationInput,
  type Invitation,
  type InvitationPreview,
} from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const invitationKeys = {
  pending: (familyId: string) => ['families', familyId, 'invitations'] as const,
  preview: (token: string) => ['invitations', 'preview', token] as const,
};

export async function listInvitations(familyId: string): Promise<Invitation[]> {
  const { invitations } = await apiRequest(
    `/families/${familyId}/invitations`,
    invitationListResponseSchema,
  );
  return invitations;
}

export async function createInvitation(
  familyId: string,
  body: CreateInvitationInput,
): Promise<Invitation> {
  const { invitation } = await apiRequest(
    `/families/${familyId}/invitations`,
    invitationResponseSchema,
    { method: 'POST', body },
  );
  return invitation;
}

export async function revokeInvitation(
  familyId: string,
  invitationId: string,
): Promise<void> {
  await apiRequest(`/families/${familyId}/invitations/${invitationId}`, okResponseSchema, {
    method: 'DELETE',
  });
}

/** Public. Works for someone who has never signed in. */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const { preview } = await apiRequest(
    `/invitations/preview?token=${encodeURIComponent(token)}`,
    invitationPreviewResponseSchema,
  );
  return preview;
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return apiRequest('/invitations/accept', acceptInvitationResponseSchema, {
    method: 'POST',
    body: { token },
  });
}