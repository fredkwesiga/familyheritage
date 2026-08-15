import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * Declares the permission a route needs. Enforced by PermissionGuard, which
 * only runs after FamilyMembershipGuard has established which family - and
 * therefore which role - the request is operating under.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);