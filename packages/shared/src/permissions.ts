import type { FamilyRoleValue } from './auth.js';

/**
 * The permission model, in one readable table.
 *
 * This lives in @fh/shared, not in the API, because both sides need it: the
 * server enforces it, and the client uses it to decide which buttons to render.
 * Two copies of a permission table drift, and the drift is always in the same
 * direction - a button that appears and then fails.
 *
 * The client's copy is a courtesy, never a control. Hiding a button is UI
 * polish; PermissionGuard on the server is the actual boundary.
 *
 * RBAC, not ABAC: a role maps to a fixed set of permissions and nothing else
 * consults the request. Two rules live outside this table, because they are not
 * role-based:
 *   1. A user may always edit the Member record they have claimed as
 *      themselves, whatever their role. People control their own representation.
 *   2. Exactly one OWNER exists per family, and ownership moves only through
 *      the transfer endpoint.
 */
export const Permission = {
  FAMILY_UPDATE: 'family:update',
  FAMILY_DELETE: 'family:delete',
  FAMILY_EXPORT: 'family:export',

  MEMBER_CREATE: 'member:create',
  MEMBER_UPDATE: 'member:update',
  MEMBER_DELETE: 'member:delete',

  RELATIONSHIP_WRITE: 'relationship:write',

  PHOTO_UPLOAD: 'photo:upload',
  PHOTO_DELETE: 'photo:delete',

  STORY_CREATE: 'story:create',
  STORY_UPDATE: 'story:update',
  STORY_DELETE: 'story:delete',

  ACCESS_INVITE: 'access:invite',
  ACCESS_REVOKE: 'access:revoke',
  ACCESS_CHANGE_ROLE: 'access:changeRole',
  ACCESS_TRANSFER_OWNERSHIP: 'access:transferOwnership',

  AUDIT_READ: 'audit:read',

  /// Seeing dates, biography and notes for LIVING members. Withheld from
  /// VIEWERs when the family has hideLivingFromViewers on.
  LIVING_VIEW_DETAILS: 'living:viewDetails',
  /// Seeing stories marked ADMINS_ONLY.
  SENSITIVE_VIEW: 'sensitive:view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const VIEWER: Permission[] = [];

const CONTRIBUTOR: Permission[] = [
  Permission.MEMBER_CREATE,
  Permission.MEMBER_UPDATE,
  Permission.RELATIONSHIP_WRITE,
  Permission.PHOTO_UPLOAD,
  Permission.STORY_CREATE,
  Permission.STORY_UPDATE,
  Permission.LIVING_VIEW_DETAILS,
];

const ADMIN: Permission[] = [
  ...CONTRIBUTOR,
  Permission.FAMILY_UPDATE,
  Permission.MEMBER_DELETE,
  Permission.PHOTO_DELETE,
  Permission.STORY_DELETE,
  Permission.ACCESS_INVITE,
  Permission.ACCESS_REVOKE,
  Permission.ACCESS_CHANGE_ROLE,
  Permission.AUDIT_READ,
  Permission.SENSITIVE_VIEW,
];

const OWNER: Permission[] = [
  ...ADMIN,
  Permission.FAMILY_DELETE,
  Permission.FAMILY_EXPORT,
  Permission.ACCESS_TRANSFER_OWNERSHIP,
];

const PERMISSIONS_BY_ROLE: Record<FamilyRoleValue, ReadonlySet<Permission>> = {
  OWNER: new Set(OWNER),
  ADMIN: new Set(ADMIN),
  CONTRIBUTOR: new Set(CONTRIBUTOR),
  VIEWER: new Set(VIEWER),
};

export function roleHasPermission(role: FamilyRoleValue, permission: Permission): boolean {
  return PERMISSIONS_BY_ROLE[role].has(permission);
}

export function permissionsForRole(role: FamilyRoleValue): Permission[] {
  return [...PERMISSIONS_BY_ROLE[role]];
}

/** Human-readable role labels and one-line explanations, for the access screen. */
export const ROLE_LABELS: Record<FamilyRoleValue, { label: string; description: string }> = {
  OWNER: {
    label: 'Owner',
    description: 'Full control, including deleting the family and transferring ownership.',
  },
  ADMIN: {
    label: 'Admin',
    description: 'Can manage people, records, stories and family settings.',
  },
  CONTRIBUTOR: {
    label: 'Contributor',
    description: 'Can add and edit relatives, photographs and stories.',
  },
  VIEWER: {
    label: 'Viewer',
    description: 'Can read the family tree and its stories, but change nothing.',
  },
};