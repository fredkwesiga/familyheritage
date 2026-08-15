import { Prisma } from '@prisma/client';

/**
 * Layer 2 of tenant isolation: a runtime safety net.
 *
 * Layer 1 is FamilyMembershipGuard, which proves the caller belongs to the
 * family named in the route. Layer 3 is Postgres row-level security, which
 * lands in the security review. This layer catches the mistake in between:
 * a service that forgets to filter by familyId.
 *
 * It does not inject familyId automatically. Auto-injection hides the bug and
 * makes the safe path invisible; throwing makes it a loud failure in
 * development, which is where you want it.
 *
 * One consequence worth knowing: findUnique on a tenant model is rejected,
 * because `where: { id }` alone carries no family scope. Use
 * findFirst({ where: { id, familyId } }) instead. That is the whole point -
 * it makes "fetch by id" impossible to write unsafely.
 */
const TENANT_MODELS = new Set([
  'Member',
  'ParentChild',
  'Partnership',
  'Photo',
  'PhotoSubject',
  'Story',
  'StorySubject',
  'Event',
  'Invitation',
  'AuditLog',
]);

/** Operations whose scope lives in `args.where`. */
const WHERE_SCOPED = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations whose scope lives in `args.data`. */
const DATA_SCOPED = new Set(['create', 'createMany']);

interface UnknownArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  create?: Record<string, unknown>;
}

function dataCarriesFamilyId(data: UnknownArgs['data']): boolean {
  if (!data) return false;
  if (Array.isArray(data)) {
    return data.length > 0 && data.every((row) => row['familyId'] !== undefined);
  }
  // A nested `family: { connect: ... }` write is also a valid scope.
  return data['familyId'] !== undefined || data['family'] !== undefined;
}

export class TenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Refusing to run ${model}.${operation} without a familyId filter. ` +
        `Every query on a tenant-scoped model must be family-scoped. ` +
        `If you meant to fetch one row by id, use findFirst({ where: { id, familyId } }).`,
    );
    this.name = 'TenantScopeError';
  }
}

export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenant-scope-guard',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) {
          return query(args);
        }

        const typedArgs = (args ?? {}) as UnknownArgs;

        if (WHERE_SCOPED.has(operation)) {
          if (typedArgs.where?.['familyId'] === undefined) {
            throw new TenantScopeError(model, operation);
          }
        } else if (DATA_SCOPED.has(operation)) {
          if (!dataCarriesFamilyId(typedArgs.data)) {
            throw new TenantScopeError(model, operation);
          }
        } else if (operation === 'upsert') {
          if (
            typedArgs.where?.['familyId'] === undefined ||
            !dataCarriesFamilyId(typedArgs.create)
          ) {
            throw new TenantScopeError(model, operation);
          }
        }

        return query(args);
      },
    },
  },
});