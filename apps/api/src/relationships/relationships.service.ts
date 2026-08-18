import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  computeRelationship,
  describeRelationship,
  ErrorCode,
  normalizeDate,
  type AddRelativeInput,
  type ApproximateDate,
  type CreateParentChildInput,
  type CreatePartnershipInput,
  type MemberRelations,
  type MemberSummary,
  type ParentLink,
  type PartnerLink,
  type RelationshipAnswer,
  type SiblingLink,
  type UpdatePartnershipInput,
} from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { toMemberSummary, type MemberRow } from '../members/member.mapper';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma/prisma.service';
import { BLOOD_RELATION_TYPES, GraphRepository } from './graph.repository';
import { RelationshipGraphLoader } from './relationship-graph.loader';

function dateColumns(prefix: 'start' | 'end', value: ApproximateDate | null | undefined) {
  if (value === undefined) return {};
  const normalized = normalizeDate(value);
  return {
    [`${prefix}Date`]: normalized.date ? new Date(`${normalized.date}T00:00:00.000Z`) : null,
    [`${prefix}DateQualifier`]: normalized.qualifier,
    [`${prefix}DateText`]: normalized.text,
  };
}

const toIsoDate = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: GraphRepository,
    private readonly members: MembersService,
    private readonly audit: AuditService,
    private readonly graphLoader: RelationshipGraphLoader,
  ) {}

    // ------------------------------------------------------ relationship answer

  /**
   * "How am I related to David?"
   *
   * Entirely deterministic. The engine in @fh/shared computes the answer from
   * the family graph and the label layer names it; no language model is
   * involved at any point. Phase 16's AI feature may one day phrase this more
   * warmly, but it will be phrasing a result it did not decide.
   */
  async relationshipBetween(
    context: FamilyContext,
    fromMemberId: string,
    toMemberId: string,
  ): Promise<RelationshipAnswer> {
    const [fromRow, toRow] = await Promise.all([
      this.requireMemberRow(context, fromMemberId),
      this.requireMemberRow(context, toMemberId),
    ]);

    const graph = await this.graphLoader.load(context.familyId);
    const result = computeRelationship(graph, fromMemberId, toMemberId);
    const hideLiving = await this.hideLiving(context);

    // Names for the shared ancestors, so the answer can say WHY - "you share
    // great-grandparents, Yusuf and Amina" - rather than only asserting a term.
    const ancestorRows = result.commonAncestorIds.length
      ? ((await this.prisma.scoped.member.findMany({
          where: { familyId: context.familyId, id: { in: result.commonAncestorIds } },
        })) as MemberRow[])
      : [];

    const viaRow = result.viaMemberId
      ? ((await this.prisma.scoped.member.findFirst({
          where: { familyId: context.familyId, id: result.viaMemberId },
        })) as MemberRow | null)
      : null;

    return {
      from: toMemberSummary(fromRow, context, hideLiving),
      to: toMemberSummary(toRow, context, hideLiving),
      kind: result.kind,
      up: result.up,
      down: result.down,
      degree: result.degree,
      removed: result.removed,
      half: result.half,
      viaAdoption: result.viaAdoption,
      commonAncestors: ancestorRows.map((row) => toMemberSummary(row, context, hideLiving)),
      via: viaRow ? toMemberSummary(viaRow, context, hideLiving) : null,
      canonical: result.canonical,
      label: describeRelationship(result, toRow.gender),
    };
  }

  // ------------------------------------------------------------ parent-child

  async linkParentChild(
    context: FamilyContext,
    input: CreateParentChildInput,
    actor: ActorContext,
  ): Promise<void> {
    const [parent, child] = await Promise.all([
      this.requireMemberRow(context, input.parentId),
      this.requireMemberRow(context, input.childId),
    ]);

    // The database rejects self-parentage with a CHECK constraint, but a longer
    // loop (A -> B -> A) is not expressible there and has to be caught here.
    // A cycle would make someone their own ancestor and hang every recursive
    // query in the product.
    if (await this.graph.wouldCreateCycle(context.familyId, input.parentId, input.childId)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `${parent.displayName} is already a descendant of ${child.displayName}, so this would create a loop.`,
      });
    }

    const relationType = input.relationType ?? 'BIOLOGICAL';

    const existing = await this.prisma.scoped.parentChild.findFirst({
      where: {
        familyId: context.familyId,
        parentId: input.parentId,
        childId: input.childId,
        relationType,
      },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'That relationship is already recorded.',
      });
    }

    await this.prisma.scoped.parentChild.create({
      data: {
        familyId: context.familyId,
        parentId: input.parentId,
        childId: input.childId,
        relationType,
        certainty: input.certainty ?? 'CONFIRMED',
        notes: input.notes ?? null,
      },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'RELATIONSHIP_CREATED',
      entityType: 'ParentChild',
      summary: `Recorded ${parent.displayName} as ${relationType.toLowerCase()} parent of ${child.displayName}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  async unlinkParentChild(
    context: FamilyContext,
    linkId: string,
    actor: ActorContext,
  ): Promise<void> {
    const link = await this.prisma.scoped.parentChild.findFirst({
      where: { id: linkId, familyId: context.familyId },
      include: { parent: true, child: true },
    });
    if (!link) throw this.linkNotFound();

    await this.prisma.scoped.parentChild.deleteMany({
      where: { id: linkId, familyId: context.familyId },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'RELATIONSHIP_DELETED',
      entityType: 'ParentChild',
      entityId: linkId,
      summary: `Removed the link between ${link.parent.displayName} and ${link.child.displayName}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ------------------------------------------------------------ partnerships

  async createPartnership(
    context: FamilyContext,
    input: CreatePartnershipInput,
    actor: ActorContext,
  ): Promise<void> {
    const [first, second] = await Promise.all([
      this.requireMemberRow(context, input.memberAId),
      this.requireMemberRow(context, input.memberBId),
    ]);

    // The pair is sorted before every write so it satisfies the
    // memberAId < memberBId CHECK constraint. That constraint is what makes one
    // row per couple canonical - without it you get two rows for the same
    // marriage that slowly disagree with each other.
    const [memberAId, memberBId] = [input.memberAId, input.memberBId].sort();

    await this.prisma.scoped.partnership.create({
      data: {
        familyId: context.familyId,
        memberAId: memberAId as string,
        memberBId: memberBId as string,
        type: input.type ?? 'MARRIAGE',
        status: input.status ?? 'ACTIVE',
        ...dateColumns('start', input.start),
        ...dateColumns('end', input.end),
        place: input.place ?? null,
        notes: input.notes ?? null,
      },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'RELATIONSHIP_CREATED',
      entityType: 'Partnership',
      summary: `Recorded a partnership between ${first.displayName} and ${second.displayName}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  async updatePartnership(
    context: FamilyContext,
    linkId: string,
    input: UpdatePartnershipInput,
    actor: ActorContext,
  ): Promise<void> {
    const existing = await this.prisma.scoped.partnership.findFirst({
      where: { id: linkId, familyId: context.familyId },
    });
    if (!existing) throw this.linkNotFound();

    await this.prisma.scoped.partnership.updateMany({
      where: { id: linkId, familyId: context.familyId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.place !== undefined ? { place: input.place } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...dateColumns('start', input.start),
        ...dateColumns('end', input.end),
      },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'RELATIONSHIP_CREATED',
      entityType: 'Partnership',
      entityId: linkId,
      summary: 'Updated a partnership',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  async deletePartnership(
    context: FamilyContext,
    linkId: string,
    actor: ActorContext,
  ): Promise<void> {
    const { count } = await this.prisma.scoped.partnership.deleteMany({
      where: { id: linkId, familyId: context.familyId },
    });
    if (count === 0) throw this.linkNotFound();

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'RELATIONSHIP_DELETED',
      entityType: 'Partnership',
      entityId: linkId,
      summary: 'Removed a partnership',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // -------------------------------------------------------- add-a-relative

  /**
   * Creates a person and links them in one step.
   *
   * This is what keeps the interface simple: the user presses "Add mother" on
   * someone's card, so the relationship is implied by where they pressed and
   * never has to be picked from a list.
   */
  async addRelative(
    context: FamilyContext,
    anchorId: string,
    input: AddRelativeInput,
    actor: ActorContext,
  ): Promise<MemberSummary> {
    const anchor = await this.requireMemberRow(context, anchorId);

    // Siblings are derived from shared parents, so making someone a sibling
    // means attaching them to the same parents. With no parents recorded there
    // is nothing to attach to, and inventing a placeholder person would put a
    // fiction in the tree.
    let anchorParentIds: string[] = [];
    if (input.relation === 'SIBLING') {
      anchorParentIds = await this.bloodParentIdsOf(context.familyId, anchorId);
      if (anchorParentIds.length === 0) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Add a parent for ${anchor.displayName} first — brothers and sisters are worked out from shared parents.`,
        });
      }
    }

    const created = await this.members.create(context, input.member, actor);
    const relationType = input.relationType ?? 'BIOLOGICAL';

    switch (input.relation) {
      case 'PARENT':
        await this.linkParentChild(
          context,
          { parentId: created.id, childId: anchorId, relationType },
          actor,
        );
        break;

      case 'CHILD':
        await this.linkParentChild(
          context,
          { parentId: anchorId, childId: created.id, relationType },
          actor,
        );
        break;

      case 'SIBLING':
        for (const parentId of anchorParentIds) {
          await this.linkParentChild(
            context,
            { parentId, childId: created.id, relationType },
            actor,
          );
        }
        break;

      case 'PARTNER':
        await this.createPartnership(
          context,
          {
            memberAId: anchorId,
            memberBId: created.id,
            type: input.partnershipType ?? 'MARRIAGE',
          },
          actor,
        );
        break;
    }

    const row = await this.requireMemberRow(context, created.id);
    return toMemberSummary(row, context, await this.hideLiving(context));
  }

  // --------------------------------------------------------------- relations

  async relationsOf(context: FamilyContext, memberId: string): Promise<MemberRelations> {
    await this.requireMemberRow(context, memberId);
    const hideLiving = await this.hideLiving(context);

    const [parentEdges, childEdges, partnerships] = await Promise.all([
      this.prisma.scoped.parentChild.findMany({
        where: { familyId: context.familyId, childId: memberId },
        include: { parent: true },
      }),
      this.prisma.scoped.parentChild.findMany({
        where: { familyId: context.familyId, parentId: memberId },
        include: { child: true },
      }),
      this.prisma.scoped.partnership.findMany({
        where: {
          familyId: context.familyId,
          OR: [{ memberAId: memberId }, { memberBId: memberId }],
        },
        include: { memberA: true, memberB: true },
      }),
    ]);

    const parents: ParentLink[] = parentEdges
      .filter((edge) => edge.parent.deletedAt === null)
      .map((edge) => ({
        linkId: edge.id,
        member: toMemberSummary(edge.parent as MemberRow, context, hideLiving),
        relationType: edge.relationType,
        certainty: edge.certainty,
        notes: edge.notes,
      }));

    const children: ParentLink[] = childEdges
      .filter((edge) => edge.child.deletedAt === null)
      .map((edge) => ({
        linkId: edge.id,
        member: toMemberSummary(edge.child as MemberRow, context, hideLiving),
        relationType: edge.relationType,
        certainty: edge.certainty,
        notes: edge.notes,
      }));

    const partners: PartnerLink[] = partnerships
      .map((row) => {
        const other = row.memberAId === memberId ? row.memberB : row.memberA;
        return { row, other };
      })
      .filter(({ other }) => other.deletedAt === null)
      .map(({ row, other }) => ({
        linkId: row.id,
        member: toMemberSummary(other as MemberRow, context, hideLiving),
        type: row.type,
        status: row.status,
        start: {
          date: toIsoDate(row.startDate),
          qualifier: row.startDateQualifier,
          text: row.startDateText,
        },
        end: {
          date: toIsoDate(row.endDate),
          qualifier: row.endDateQualifier,
          text: row.endDateText,
        },
        place: row.place,
      }));

    return {
      memberId,
      parents,
      children,
      partners,
      siblings: await this.siblingsOf(context, memberId, hideLiving),
    };
  }

  /**
   * Siblings, derived. Never stored.
   *
   * Two deliberate rules:
   *
   * 1. Only BIOLOGICAL and ADOPTIVE edges count. Including STEP would make two
   *    unrelated children of the same step-parent appear as siblings, which is
   *    simply false - they share a household, not a parent.
   *
   * 2. "Full" requires two shared parents. With one parent recorded we cannot
   *    evidence a full sibling, so we say half rather than overclaim. This is
   *    the same conservatism as leaving a date blank instead of guessing it.
   */
  private async siblingsOf(
    context: FamilyContext,
    memberId: string,
    hideLiving: boolean,
  ): Promise<SiblingLink[]> {
    const anchorParentIds = await this.bloodParentIdsOf(context.familyId, memberId);
    if (anchorParentIds.length === 0) return [];

    const candidateEdges = await this.prisma.scoped.parentChild.findMany({
      where: {
        familyId: context.familyId,
        parentId: { in: anchorParentIds },
        childId: { not: memberId },
        relationType: { in: [...BLOOD_RELATION_TYPES] },
      },
      include: { child: true },
    });

    const byChild = new Map<string, { row: MemberRow; sharedParentIds: Set<string> }>();
    for (const edge of candidateEdges) {
      if (edge.child.deletedAt !== null) continue;
      const entry = byChild.get(edge.childId) ?? {
        row: edge.child as MemberRow,
        sharedParentIds: new Set<string>(),
      };
      entry.sharedParentIds.add(edge.parentId);
      byChild.set(edge.childId, entry);
    }

    return [...byChild.values()]
      .map(({ row, sharedParentIds }) => ({
        member: toMemberSummary(row, context, hideLiving),
        kind: (sharedParentIds.size >= 2 ? 'FULL' : 'HALF') as 'FULL' | 'HALF',
        sharedParentIds: [...sharedParentIds],
      }))
      .sort((a, b) => a.member.displayName.localeCompare(b.member.displayName));
  }

  // ----------------------------------------------------------------- helpers

  private async bloodParentIdsOf(familyId: string, memberId: string): Promise<string[]> {
    const edges = await this.prisma.scoped.parentChild.findMany({
      where: {
        familyId,
        childId: memberId,
        relationType: { in: [...BLOOD_RELATION_TYPES] },
      },
      select: { parentId: true },
    });
    return edges.map((edge) => edge.parentId);
  }

  private async requireMemberRow(context: FamilyContext, memberId: string): Promise<MemberRow> {
    const row = (await this.prisma.scoped.member.findFirst({
      where: { id: memberId, familyId: context.familyId, deletedAt: null },
    })) as MemberRow | null;

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That person is not in this family tree.',
      });
    }
    return row;
  }

  private async hideLiving(context: FamilyContext): Promise<boolean> {
    const family = await this.prisma.family.findFirst({
      where: { id: context.familyId },
      select: { hideLivingFromViewers: true },
    });
    return family?.hideLivingFromViewers ?? true;
  }

  private linkNotFound(): NotFoundException {
    return new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'That relationship is not recorded in this family.',
    });
  }
}