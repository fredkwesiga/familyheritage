import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Raw graph traversal.
 *
 * Prisma cannot express recursive CTEs, so this is the one place in the
 * codebase that writes SQL by hand - deliberately isolated here so that the
 * rest of the API keeps working through the type-safe client. Phase 7's
 * relationship engine builds on these same primitives.
 *
 * Two safety measures appear in every query:
 *   UNION rather than UNION ALL, which stops an existing cycle looping forever
 *   a depth cap, as a second line of defence
 *
 * Table and column names are quoted because Prisma's default mapping is
 * PascalCase tables and camelCase columns.
 */
const MAX_DEPTH = 30;

/** Only these edge types imply shared ancestry. See siblingsOf for why. */
export const BLOOD_RELATION_TYPES = ['BIOLOGICAL', 'ADOPTIVE'] as const;

interface IdRow {
  id: string;
}

@Injectable()
export class GraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every ancestor of a member, at any depth.
   *
   * Used to prevent cycles: if the proposed parent already appears among the
   * child's ancestors, the link would close a loop and hang every recursive
   * query in the product.
   */
  async ancestorIds(familyId: string, memberId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<IdRow[]>(Prisma.sql`
      WITH RECURSIVE ancestors AS (
        SELECT pc."parentId" AS id, 1 AS depth
        FROM "ParentChild" pc
        WHERE pc."childId" = ${memberId}::uuid
          AND pc."familyId" = ${familyId}::uuid

        UNION

        SELECT pc."parentId", a.depth + 1
        FROM "ParentChild" pc
        JOIN ancestors a ON pc."childId" = a.id
        WHERE pc."familyId" = ${familyId}::uuid
          AND a.depth < ${MAX_DEPTH}
      )
      SELECT DISTINCT id FROM ancestors
    `);
    return rows.map((row) => row.id);
  }

  /** Every descendant of a member, at any depth. */
  async descendantIds(familyId: string, memberId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<IdRow[]>(Prisma.sql`
      WITH RECURSIVE descendants AS (
        SELECT pc."childId" AS id, 1 AS depth
        FROM "ParentChild" pc
        WHERE pc."parentId" = ${memberId}::uuid
          AND pc."familyId" = ${familyId}::uuid

        UNION

        SELECT pc."childId", d.depth + 1
        FROM "ParentChild" pc
        JOIN descendants d ON pc."parentId" = d.id
        WHERE pc."familyId" = ${familyId}::uuid
          AND d.depth < ${MAX_DEPTH}
      )
      SELECT DISTINCT id FROM descendants
    `);
    return rows.map((row) => row.id);
  }

  /**
   * Would adding parent -> child create a cycle?
   *
   * True when the proposed parent is already a descendant of the child, which
   * would make someone their own ancestor. The database cannot express this as
   * a CHECK constraint, so it is enforced here before every insert.
   */
  async wouldCreateCycle(familyId: string, parentId: string, childId: string): Promise<boolean> {
    if (parentId === childId) return true;
    const descendants = await this.descendantIds(familyId, childId);
    return descendants.includes(parentId);
  }
}