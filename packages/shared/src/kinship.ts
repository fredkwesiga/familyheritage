import type { ParentRelationType } from './relationship.js';

/**
 * The relationship engine.
 *
 * A pure function over a graph. No database, no network, and above all no
 * language model: a relationship is a fact derivable from the tree, and an
 * LLM that guesses "second cousin once removed" and gets it wrong once will
 * destroy trust in every other answer the product gives. Phase 16's AI layer
 * only turns the structured result below into a sentence, and everything works
 * with it switched off.
 *
 * It lives in @fh/shared rather than the API because it is pure - which makes
 * it testable without Nest or Prisma, and reusable by the tree view.
 */

/** Only these edge types carry ancestry. Step and foster are social, not lineal. */
const BLOOD_TYPES: ReadonlySet<ParentRelationType> = new Set(['BIOLOGICAL', 'ADOPTIVE']);

export interface ParentEdge {
  id: string;
  type: ParentRelationType;
}

export interface FamilyGraph {
  /** childId -> the people recorded as their parents */
  parents: Map<string, ParentEdge[]>;
  /** parentId -> the people recorded as their children */
  children: Map<string, ParentEdge[]>;
  /** memberId -> partners, both directions */
  partners: Map<string, string[]>;
}

export interface GraphInput {
  parentChild: Array<{ parentId: string; childId: string; relationType: ParentRelationType }>;
  partnerships: Array<{ memberAId: string; memberBId: string }>;
}

export function buildFamilyGraph(input: GraphInput): FamilyGraph {
  const parents = new Map<string, ParentEdge[]>();
  const children = new Map<string, ParentEdge[]>();
  const partners = new Map<string, string[]>();

  for (const edge of input.parentChild) {
    const parentList = parents.get(edge.childId) ?? [];
    parentList.push({ id: edge.parentId, type: edge.relationType });
    parents.set(edge.childId, parentList);

    const childList = children.get(edge.parentId) ?? [];
    childList.push({ id: edge.childId, type: edge.relationType });
    children.set(edge.parentId, childList);
  }

  for (const link of input.partnerships) {
    const a = partners.get(link.memberAId) ?? [];
    a.push(link.memberBId);
    partners.set(link.memberAId, a);

    const b = partners.get(link.memberBId) ?? [];
    b.push(link.memberAId);
    partners.set(link.memberBId, b);
  }

  return { parents, children, partners };
}

export type RelationshipKind =
  | 'SELF'
  | 'PARTNER'
  | 'ANCESTOR'
  | 'DESCENDANT'
  | 'SIBLING'
  | 'AUNT_UNCLE'
  | 'NIECE_NEPHEW'
  | 'COUSIN'
  | 'STEP_PARENT'
  | 'STEP_CHILD'
  | 'IN_LAW'
  | 'UNRELATED';

export interface RelationshipResult {
  kind: RelationshipKind;
  /** Steps from the subject up to the common ancestor. */
  up: number;
  /** Steps from the common ancestor down to the other person. */
  down: number;
  /** Cousin degree: 1 = first cousin. Zero for non-cousins. */
  degree: number;
  /** Generational offset between cousins. */
  removed: number;
  /** True when fewer than two ancestors are shared at the sibling level. */
  half: boolean;
  /** True when the connecting path passes through an adoptive link. */
  viaAdoption: boolean;
  /**
   * Every lowest common ancestor, not just one.
   *
   * Cousin marriage and double cousins produce more than one, and taking the
   * first silently understates the relationship.
   */
  commonAncestorIds: string[];
  /** For in-law and step relationships: the person the connection runs through. */
  viaMemberId: string | null;
  /** A stable machine-readable form, e.g. "cousin(2,1)". Never shown to a user. */
  canonical: string;
}

const UNRELATED: RelationshipResult = {
  kind: 'UNRELATED',
  up: 0,
  down: 0,
  degree: 0,
  removed: 0,
  half: false,
  viaAdoption: false,
  commonAncestorIds: [],
  viaMemberId: null,
  canonical: 'unrelated',
};

/**
 * Ancestors of a member with their minimum distance, including the member
 * themselves at distance zero.
 *
 * Breadth-first with a visited set, so a cycle in corrupt data terminates
 * rather than hanging the request.
 */
export function ancestorDepths(graph: FamilyGraph, memberId: string): Map<string, number> {
  const depths = new Map<string, number>([[memberId, 0]]);
  let frontier = [memberId];
  let depth = 0;

  while (frontier.length > 0 && depth < 40) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.parents.get(id) ?? []) {
        if (!BLOOD_TYPES.has(edge.type)) continue;
        if (depths.has(edge.id)) continue;
        depths.set(edge.id, depth);
        next.push(edge.id);
      }
    }
    frontier = next;
  }

  return depths;
}

/**
 * Are these two half-siblings?
 *
 * Only when there is positive evidence of a difference: they share exactly one
 * parent, AND at least one of them has a second parent recorded who is not
 * shared.
 *
 * An earlier version called anyone with fewer than two shared parents a
 * half-sibling, which was wrong in the ordinary case. A family who adds two
 * children to a single parent - because only one parent is known, which is
 * common - meant nothing by it, and telling them their children are
 * half-siblings is an assertion they never made about their own family.
 *
 * Absence of evidence is not evidence of difference. Where we cannot tell, we
 * say sibling and leave it there.
 */
export function areHalfSiblings(
  graph: FamilyGraph,
  memberId: string,
  otherId: string,
): boolean {
  const mine = bloodParentIds(graph, memberId);
  const theirs = bloodParentIds(graph, otherId);
  const shared = mine.filter((id) => theirs.includes(id));

  if (shared.length >= 2) return false;
  if (shared.length === 0) return false;

  // One shared parent. Half only if someone has a second, different one.
  return mine.length >= 2 || theirs.length >= 2;
}

function bloodParentIds(graph: FamilyGraph, memberId: string): string[] {
  return (graph.parents.get(memberId) ?? [])
    .filter((edge) => BLOOD_TYPES.has(edge.type))
    .map((edge) => edge.id);
}

/** Does any path between the two people run through an adoptive link? */
function pathUsesAdoption(graph: FamilyGraph, fromId: string, ancestorId: string): boolean {
  const seen = new Set<string>([fromId]);
  let frontier: Array<{ id: string; adopted: boolean }> = [{ id: fromId, adopted: false }];

  for (let depth = 0; depth < 40 && frontier.length > 0; depth += 1) {
    const next: Array<{ id: string; adopted: boolean }> = [];
    for (const node of frontier) {
      if (node.id === ancestorId && node.adopted) return true;
      for (const edge of graph.parents.get(node.id) ?? []) {
        if (!BLOOD_TYPES.has(edge.type)) continue;
        const adopted = node.adopted || edge.type === 'ADOPTIVE';
        const key = `${edge.id}:${String(adopted)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ id: edge.id, adopted });
      }
    }
    frontier = next;
  }
  return false;
}

/**
 * How is `otherId` related to `subjectId`?
 *
 * The result reads from the subject's perspective: ANCESTOR means the other
 * person is an ancestor of the subject.
 */
export function computeRelationship(
  graph: FamilyGraph,
  subjectId: string,
  otherId: string,
  /**
   * Internal. The in-law checks below ask "is this person married to a relative
   * of mine?", which means calling this function again - and if that call also
   * ran the in-law checks it would call back, forever. Marriage is not
   * transitive in any useful sense anyway: your wife's sister's husband is not
   * your relative, and following that chain would eventually connect everyone
   * to everyone. One hop only.
   */
  followMarriage = true,
): RelationshipResult {
  if (subjectId === otherId) {
    return { ...UNRELATED, kind: 'SELF', canonical: 'self' };
  }

  const subjectAncestors = ancestorDepths(graph, subjectId);
  const otherAncestors = ancestorDepths(graph, otherId);

  // --- Blood ---------------------------------------------------------------

  let bestSum = Infinity;
  let bestPairs: Array<{ id: string; up: number; down: number }> = [];

  for (const [ancestorId, up] of subjectAncestors) {
    const down = otherAncestors.get(ancestorId);
    if (down === undefined) continue;
    const sum = up + down;
    if (sum < bestSum) {
      bestSum = sum;
      bestPairs = [{ id: ancestorId, up, down }];
    } else if (sum === bestSum) {
      bestPairs.push({ id: ancestorId, up, down });
    }
  }

  if (bestPairs.length > 0) {
    const first = bestPairs[0] as { id: string; up: number; down: number };
    const { up, down } = first;
    const commonAncestorIds = bestPairs.map((pair) => pair.id);

    const viaAdoption =
      pathUsesAdoption(graph, subjectId, first.id) || pathUsesAdoption(graph, otherId, first.id);

    const base = { up, down, degree: 0, removed: 0, half: false, viaAdoption, commonAncestorIds, viaMemberId: null };

    // The other person is an ancestor of the subject.
    if (down === 0) {
      return { ...base, kind: 'ANCESTOR', canonical: `ancestor(${up})` };
    }

    // The subject is an ancestor of the other person.
    if (up === 0) {
      return { ...base, kind: 'DESCENDANT', canonical: `descendant(${down})` };
    }

    if (up === 1 && down === 1) {
      // Half is decided by how many parents are actually shared, not by how
      // many common ancestors we happened to find. With one parent recorded we
      // cannot evidence a full sibling, so we do not claim one.
      const shared = new Set(bloodParentIds(graph, subjectId)).size;
      const sharedWithOther = bloodParentIds(graph, otherId).filter((id) =>
        bloodParentIds(graph, subjectId).includes(id),
      );
      if (up === 1 && down === 1) {
        const half = areHalfSiblings(graph, subjectId, otherId);
        return { ...base, kind: 'SIBLING', half, canonical: half ? 'half-sibling' : 'sibling' };
      }
    }

    if (up === 1) {
      // Subject is a child of the common ancestor; the other person is further
      // down - a niece or nephew, or a great- one.
      return {
        ...base,
        degree: down - 2,
        kind: 'NIECE_NEPHEW',
        canonical: `niece-nephew(${down - 2})`,
      };
    }

    if (down === 1) {
      return {
        ...base,
        degree: up - 2,
        kind: 'AUNT_UNCLE',
        canonical: `aunt-uncle(${up - 2})`,
      };
    }

    const degree = Math.min(up, down) - 1;
    const removed = Math.abs(up - down);
    return { ...base, kind: 'COUSIN', degree, removed, canonical: `cousin(${degree},${removed})` };
  }

  // --- By marriage ---------------------------------------------------------

  if ((graph.partners.get(subjectId) ?? []).includes(otherId)) {
    return { ...UNRELATED, kind: 'PARTNER', canonical: 'partner' };
  }

  // A partner of one of the subject's parents, who is not themselves a parent.
  for (const parentId of bloodParentIds(graph, subjectId)) {
    if ((graph.partners.get(parentId) ?? []).includes(otherId)) {
      return { ...UNRELATED, kind: 'STEP_PARENT', viaMemberId: parentId, canonical: 'step-parent' };
    }
  }

  // A child of one of the subject's partners, who is not the subject's child.
  for (const partnerId of graph.partners.get(subjectId) ?? []) {
    const partnerChildren = (graph.children.get(partnerId) ?? []).map((edge) => edge.id);
    if (partnerChildren.includes(otherId)) {
      return { ...UNRELATED, kind: 'STEP_CHILD', viaMemberId: partnerId, canonical: 'step-child' };
    }
  }

  if (!followMarriage) return UNRELATED;

  // The other person is married to a blood relative of the subject.
  for (const partnerId of graph.partners.get(otherId) ?? []) {
    const relation = computeRelationship(graph, subjectId, partnerId, false);
    if (relation.kind !== 'UNRELATED' && relation.kind !== 'SELF') {
      return { ...UNRELATED, kind: 'IN_LAW', viaMemberId: partnerId, canonical: 'in-law' };
    }
  }

  // The subject is married to a blood relative of the other person.
  for (const partnerId of graph.partners.get(subjectId) ?? []) {
    const relation = computeRelationship(graph, partnerId, otherId, false);
    if (relation.kind !== 'UNRELATED' && relation.kind !== 'SELF') {
      return { ...UNRELATED, kind: 'IN_LAW', viaMemberId: partnerId, canonical: 'in-law' };
    }
  }

  return UNRELATED;
}


/**
 * The people immediately around one person.
 *
 * Used by the focus view, which shows exactly this: parents above, partners
 * beside, siblings across, children below. Deriving it here rather than in a
 * component means the tree and the relations list cannot disagree.
 */
export interface ImmediateRelatives {
  parentIds: string[];
  childIds: string[];
  partnerIds: string[];
  /** Derived from shared blood parents, with the same rule used everywhere else. */
  siblings: Array<{ id: string; half: boolean }>;
}

export function immediateRelatives(graph: FamilyGraph, memberId: string): ImmediateRelatives {
  const parentIds = bloodParentIds(graph, memberId);

  const childIds = (graph.children.get(memberId) ?? [])
    .filter((edge) => BLOOD_TYPES.has(edge.type))
    .map((edge) => edge.id);

  const partnerIds = [...new Set(graph.partners.get(memberId) ?? [])];

  // Count how many parents each candidate shares. Two or more means full.
  const sharedCounts = new Map<string, number>();
  for (const parentId of parentIds) {
    for (const edge of graph.children.get(parentId) ?? []) {
      if (!BLOOD_TYPES.has(edge.type)) continue;
      if (edge.id === memberId) continue;
      sharedCounts.set(edge.id, (sharedCounts.get(edge.id) ?? 0) + 1);
    }
  }

  const siblings = [...sharedCounts.entries()].map(([id, shared]) => ({
    id,
    half: shared < 2 || parentIds.length < 2,
  }));

  return { parentIds, childIds, partnerIds, siblings };
}

/**
 * Generation numbers for laying a tree out.
 *
 * Zero is the focused person; negative is upward. Breadth-first from the focus
 * through parents, children and partners, so a spouse sits on the same row as
 * the person they married even when they have no blood tie to the family.
 */
export function generationIndex(graph: FamilyGraph, rootId: string): Map<string, number> {
  const generations = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const generation = generations.get(id) as number;

    for (const edge of graph.parents.get(id) ?? []) {
      if (!BLOOD_TYPES.has(edge.type) || generations.has(edge.id)) continue;
      generations.set(edge.id, generation - 1);
      queue.push(edge.id);
    }
    for (const edge of graph.children.get(id) ?? []) {
      if (!BLOOD_TYPES.has(edge.type) || generations.has(edge.id)) continue;
      generations.set(edge.id, generation + 1);
      queue.push(edge.id);
    }
    for (const partnerId of graph.partners.get(id) ?? []) {
      if (generations.has(partnerId)) continue;
      generations.set(partnerId, generation);
      queue.push(partnerId);
    }
  }

  return generations;
}