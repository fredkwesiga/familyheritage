import { generationIndex, type FamilyGraph, type MemberSummary } from '@fh/shared';

/**
 * Family-tree layout.
 *
 * Written by hand rather than delegated to a general graph layout engine, and
 * that is a deliberate reversal of an earlier decision to use elkjs.
 *
 * A family tree is not a general graph. Its vertical axis is fixed - generation
 * decides the row, and nothing else may - and it has a hard constraint no
 * layered layout engine expresses naturally: partners must sit next to each
 * other, with their children hanging below the pair. Coercing a general engine
 * into those rules takes more configuration than writing the rules, produces
 * layouts that drift when the graph changes slightly, and costs about 1.5 MB
 * plus the Web Worker needed to keep it off the main thread.
 *
 * What follows is the classic approach for this shape: rank by generation, then
 * reduce crossings by repeatedly sorting each row toward the average position of
 * its neighbours, then pull couples together. Roughly a hundred lines, entirely
 * deterministic, and debuggable by reading it.
 */

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 88;
const HORIZONTAL_GAP = 28;
const VERTICAL_GAP = 96;
const COUPLE_GAP = 12;

export interface LaidOutNode {
  member: MemberSummary;
  x: number;
  y: number;
  generation: number;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  /** Members inside the depth window; used to filter edges. */
  visibleIds: Set<string>;
  /** How many people were left out because of the depth limit. */
  hiddenCount: number;
}

export interface LayoutOptions {
  /** Generations above and below the focus. Two is legible; four is a wall. */
  depth: number;
  /** Hard ceiling. React Flow renders a DOM node per person and degrades past ~300. */
  maxNodes: number;
}

export function layoutFamilyTree(
  graph: FamilyGraph,
  byId: Map<string, MemberSummary>,
  focusId: string,
  options: LayoutOptions,
): TreeLayout {
  const generations = generationIndex(graph, focusId);

  // --- 1. Which people are in view ----------------------------------------

  const inWindow: Array<{ id: string; generation: number }> = [];
  for (const [id, generation] of generations) {
    if (Math.abs(generation) > options.depth) continue;
    if (!byId.has(id)) continue;
    inWindow.push({ id, generation });
  }

  // Nearest generations first, so the cap trims the outer edges of the tree
  // rather than an arbitrary slice of it.
  inWindow.sort((a, b) => Math.abs(a.generation) - Math.abs(b.generation));
  const kept = inWindow.slice(0, options.maxNodes);
  const hiddenCount = generations.size - kept.length;

  const visibleIds = new Set(kept.map((entry) => entry.id));

  // --- 2. Group into rows --------------------------------------------------

  const rows = new Map<number, string[]>();
  for (const entry of kept) {
    const row = rows.get(entry.generation) ?? [];
    row.push(entry.id);
    rows.set(entry.generation, row);
  }

  const generationNumbers = [...rows.keys()].sort((a, b) => a - b);

  // --- 3. Seed the focus row, then order outward ---------------------------

  const focusRow = rows.get(0);
  if (focusRow) {
    // The focused person leads their row; their partners follow immediately.
    const partners = new Set(graph.partners.get(focusId) ?? []);
    focusRow.sort((a, b) => {
      if (a === focusId) return -1;
      if (b === focusId) return 1;
      const aPartner = partners.has(a) ? 0 : 1;
      const bPartner = partners.has(b) ? 0 : 1;
      return aPartner - bPartner;
    });
  }

  const positionInRow = new Map<string, number>();
  const recordPositions = () => {
    for (const row of rows.values()) {
      row.forEach((id, index) => positionInRow.set(id, index));
    }
  };
  recordPositions();

  /**
   * Sort a row toward the average position of each node's neighbours in an
   * adjacent row. Two sweeps in each direction settles a family tree; more
   * gains nothing and risks oscillating.
   */
  const barycentreSweep = (direction: 'down' | 'up') => {
    const order = direction === 'down' ? generationNumbers : [...generationNumbers].reverse();

    for (const generation of order) {
      const row = rows.get(generation);
      if (!row || generation === 0) continue;

      const neighboursOf = (id: string): string[] =>
        direction === 'down'
          ? (graph.parents.get(id) ?? []).map((edge) => edge.id)
          : (graph.children.get(id) ?? []).map((edge) => edge.id);

      const barycentre = new Map<string, number>();
      for (const id of row) {
        const positions = neighboursOf(id)
          .map((neighbourId) => positionInRow.get(neighbourId))
          .filter((position): position is number => position !== undefined);

        barycentre.set(
          id,
          positions.length > 0
            ? positions.reduce((sum, value) => sum + value, 0) / positions.length
            : (positionInRow.get(id) ?? 0),
        );
      }

      row.sort((a, b) => (barycentre.get(a) ?? 0) - (barycentre.get(b) ?? 0));
      recordPositions();
    }
  };

  barycentreSweep('down');
  barycentreSweep('up');
  barycentreSweep('down');

  // --- 4. Pull couples together -------------------------------------------

  // Crossing reduction alone will happily separate a married couple, which
  // reads as wrong however few lines it crosses. Adjacency wins.
  for (const row of rows.values()) {
    const placed: string[] = [];
    const taken = new Set<string>();

    for (const id of row) {
      if (taken.has(id)) continue;
      placed.push(id);
      taken.add(id);

      for (const partnerId of graph.partners.get(id) ?? []) {
        if (taken.has(partnerId) || !row.includes(partnerId)) continue;
        placed.push(partnerId);
        taken.add(partnerId);
      }
    }

    row.splice(0, row.length, ...placed);
  }
  recordPositions();

  // --- 5. Coordinates ------------------------------------------------------

  const nodes: LaidOutNode[] = [];
  const partnerOf = (id: string) => new Set(graph.partners.get(id) ?? []);

  for (const generation of generationNumbers) {
    const row = rows.get(generation) ?? [];

    // Couples sit closer together than unrelated neighbours, so a pair reads as
    // a pair without needing a box drawn round it.
    const offsets: number[] = [];
    let cursor = 0;
    row.forEach((id, index) => {
      if (index > 0) {
        const previous = row[index - 1] as string;
        cursor += NODE_WIDTH + (partnerOf(id).has(previous) ? COUPLE_GAP : HORIZONTAL_GAP);
      }
      offsets.push(cursor);
    });

    const rowWidth = offsets.length > 0 ? (offsets[offsets.length - 1] as number) + NODE_WIDTH : 0;
    const rowStart = -rowWidth / 2;

    row.forEach((id, index) => {
      const member = byId.get(id);
      if (!member) return;
      nodes.push({
        member,
        x: rowStart + (offsets[index] as number),
        y: generation * (NODE_HEIGHT + VERTICAL_GAP),
        generation,
      });
    });
  }

  return { nodes, visibleIds, hiddenCount };
}