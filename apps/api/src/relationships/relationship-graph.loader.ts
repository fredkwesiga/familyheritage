import { Injectable } from '@nestjs/common';
import { buildFamilyGraph, type FamilyGraph } from '@fh/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Loads a whole family's edges into memory as a graph.
 *
 * Two or three hundred rows is nothing, and having the entire structure in
 * memory lets the engine stay a pure function - no database calls inside the
 * traversal, no N+1, and the same code runs in a unit test with a hand-built
 * fixture.
 *
 * If a family ever reaches the tens of thousands of edges this becomes a
 * recursive CTE instead. Nothing above it would change.
 */
@Injectable()
export class RelationshipGraphLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(familyId: string): Promise<FamilyGraph> {
    const [parentChild, partnerships] = await Promise.all([
      this.prisma.scoped.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, relationType: true },
      }),
      this.prisma.scoped.partnership.findMany({
        where: { familyId },
        select: { memberAId: true, memberBId: true },
      }),
    ]);

    return buildFamilyGraph({ parentChild, partnerships });
  }
}