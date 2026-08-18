import { buildFamilyGraph, type FamilyGraph } from '../src/kinship.js';

/**
 * The Kwesiga fixture, as a graph.
 *
 * The same shape as the database seed from Phase 2, and chosen for the same
 * reason: it contains every case that breaks naive family-tree code, so the
 * tests below exercise real structures rather than convenient ones.
 *
 *   Yusuf ═ Amina
 *     ├── Peter ═ Josephine        (first marriage)
 *     │     ├── John ═ Ruth
 *     │     │     ├── Fred ── Isaac
 *     │     │     └── Miriam
 *     │     └── Grace ═ Samuel
 *     │           └── Anna          (ADOPTED)
 *     │
 *     │   Peter ═ Esther            (remarriage, after Josephine died)
 *     │     └── Moses               (HALF-sibling of John and Grace)
 *     │         Esther is also STEP-parent to John and Grace
 *     │
 *     ├── Sarah
 *     │     └── Robert              (father not recorded)
 *     │           └── David
 *     └── Daniel                    (no children)
 */
export const P = {
  yusuf: 'yusuf',
  amina: 'amina',
  peter: 'peter',
  sarah: 'sarah',
  daniel: 'daniel',
  josephine: 'josephine',
  esther: 'esther',
  john: 'john',
  grace: 'grace',
  moses: 'moses',
  robert: 'robert',
  ruth: 'ruth',
  samuel: 'samuel',
  fred: 'fred',
  miriam: 'miriam',
  anna: 'anna',
  david: 'david',
  isaac: 'isaac',
} as const;

export function kwesigaGraph(): FamilyGraph {
  return buildFamilyGraph({
    parentChild: [
      // Generation 1 -> 2
      { parentId: P.yusuf, childId: P.peter, relationType: 'BIOLOGICAL' },
      { parentId: P.amina, childId: P.peter, relationType: 'BIOLOGICAL' },
      { parentId: P.yusuf, childId: P.sarah, relationType: 'BIOLOGICAL' },
      { parentId: P.amina, childId: P.sarah, relationType: 'BIOLOGICAL' },
      { parentId: P.yusuf, childId: P.daniel, relationType: 'BIOLOGICAL' },
      { parentId: P.amina, childId: P.daniel, relationType: 'BIOLOGICAL' },

      // Peter + Josephine
      { parentId: P.peter, childId: P.john, relationType: 'BIOLOGICAL' },
      { parentId: P.josephine, childId: P.john, relationType: 'BIOLOGICAL' },
      { parentId: P.peter, childId: P.grace, relationType: 'BIOLOGICAL' },
      { parentId: P.josephine, childId: P.grace, relationType: 'BIOLOGICAL' },

      // Peter + Esther -> Moses, a half-sibling
      { parentId: P.peter, childId: P.moses, relationType: 'BIOLOGICAL' },
      { parentId: P.esther, childId: P.moses, relationType: 'BIOLOGICAL' },

      // Esther is also step-mother to Peter's older children
      { parentId: P.esther, childId: P.john, relationType: 'STEP' },
      { parentId: P.esther, childId: P.grace, relationType: 'STEP' },

      // Sarah -> Robert, father not recorded
      { parentId: P.sarah, childId: P.robert, relationType: 'BIOLOGICAL' },
      { parentId: P.robert, childId: P.david, relationType: 'BIOLOGICAL' },

      // John + Ruth
      { parentId: P.john, childId: P.fred, relationType: 'BIOLOGICAL' },
      { parentId: P.ruth, childId: P.fred, relationType: 'BIOLOGICAL' },
      { parentId: P.john, childId: P.miriam, relationType: 'BIOLOGICAL' },
      { parentId: P.ruth, childId: P.miriam, relationType: 'BIOLOGICAL' },

      // Grace + Samuel adopted Anna
      { parentId: P.grace, childId: P.anna, relationType: 'ADOPTIVE' },
      { parentId: P.samuel, childId: P.anna, relationType: 'ADOPTIVE' },

      // Fred -> Isaac
      { parentId: P.fred, childId: P.isaac, relationType: 'BIOLOGICAL' },
    ],
    partnerships: [
      { memberAId: P.yusuf, memberBId: P.amina },
      { memberAId: P.peter, memberBId: P.josephine },
      { memberAId: P.peter, memberBId: P.esther },
      { memberAId: P.john, memberBId: P.ruth },
      { memberAId: P.grace, memberBId: P.samuel },
    ],
  });
}