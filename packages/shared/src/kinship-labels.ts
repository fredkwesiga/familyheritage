import type { RelationshipKind, RelationshipResult } from './kinship.js';

/**
 * Which system of kinship terms to use.
 *
 * WESTERN is the anglophone convention: your parent's cousin is a "first cousin
 * once removed", and your cousin's child is the same.
 *
 * CLASSIFICATORY is how a great many families actually speak, including across
 * much of Uganda and East Africa: your parent's cousin is your uncle, your
 * cousin's child is your niece or nephew, and your cousins are your brothers
 * and sisters. Neither is more correct - they are different systems, and a
 * product that only speaks one of them is telling a large share of its users
 * that their own words for their own family are wrong.
 *
 * The engine is untouched by this. It returns cousin(1, 1) either way; only the
 * word changes.
 */
export type KinshipStyle = 'WESTERN' | 'CLASSIFICATORY';

/**
 * English kinship terms.
 *
 * Deliberately separate from the engine.
 *
 * The engine returns cousin(2, 1); this file decides that English calls that
 * "second cousin once removed". Many kinship systems - including several used
 * in Uganda - would call the same person a brother, or would distinguish a
 * mother's brother from a father's brother with two different words where
 * English has only "uncle". Baking those terms into the engine would make the
 * engine wrong for a large share of the people this product is for.
 *
 * Adding a second language means adding a file next to this one. The engine
 * does not change.
 */

const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

const REMOVALS = ['', 'once removed', 'twice removed', 'three times removed'];

function ordinal(value: number): string {
  return ORDINALS[value - 1] ?? `${value}th`;
}

function removal(value: number): string {
  if (value === 0) return '';
  return REMOVALS[value] ?? `${value} times removed`;
}

/** "great-great-" for a greatness of 2. */
function greats(count: number): string {
  return count > 0 ? 'great-'.repeat(count) : '';
}

type Gendered = { masculine: string; feminine: string; neutral: string };

function pick(term: Gendered, gender: string | null | undefined): string {
  const normalized = gender?.trim().toLowerCase() ?? '';
  if (['male', 'm', 'man', 'boy'].includes(normalized)) return term.masculine;
  if (['female', 'f', 'woman', 'girl'].includes(normalized)) return term.feminine;
  return term.neutral;
}

const PARENT: Gendered = { masculine: 'father', feminine: 'mother', neutral: 'parent' };
const CHILD: Gendered = { masculine: 'son', feminine: 'daughter', neutral: 'child' };
const SIBLING: Gendered = { masculine: 'brother', feminine: 'sister', neutral: 'sibling' };
const AUNT_UNCLE: Gendered = { masculine: 'uncle', feminine: 'aunt', neutral: 'aunt or uncle' };
const NIBLING: Gendered = { masculine: 'nephew', feminine: 'niece', neutral: 'niece or nephew' };
const PARTNER: Gendered = { masculine: 'husband', feminine: 'wife', neutral: 'partner' };
const GRANDPARENT: Gendered = {
  masculine: 'grandfather',
  feminine: 'grandmother',
  neutral: 'grandparent',
};
const GRANDCHILD: Gendered = {
  masculine: 'grandson',
  feminine: 'granddaughter',
  neutral: 'grandchild',
};

/**
 * Turns a computed relationship into an English term.
 *
 * `gender` is the other person's, used only to choose a word. It is optional
 * everywhere, and the neutral term is a complete answer rather than a fallback.
 */
export function describeRelationship(
  result: RelationshipResult,
  gender?: string | null,
  style: KinshipStyle = 'WESTERN',
): string {
  // In a classificatory system the generational position decides the word, not
  // the count of steps. Someone a generation above you is an aunt or uncle
  // whether they are your parent's sibling or your parent's cousin.
  if (style === 'CLASSIFICATORY' && result.kind === 'COUSIN') {
    if (result.removed === 0) {
      return pick(SIBLING, gender);
    }
    // up < down means the other person sits further from the shared ancestor,
    // and so a generation below the reader.
    return result.down > result.up
      ? prefixed(result, pick(NIBLING, gender))
      : prefixed(result, pick(AUNT_UNCLE, gender));
  }

  switch (result.kind) {
    case 'SELF':
      return 'the same person';

    case 'PARTNER':
      return pick(PARTNER, gender);

    case 'ANCESTOR': {
      if (result.up === 1) return prefixed(result, pick(PARENT, gender));
      if (result.up === 2) return prefixed(result, pick(GRANDPARENT, gender));
      return prefixed(result, `${greats(result.up - 2)}${pick(GRANDPARENT, gender)}`);
    }

    case 'DESCENDANT': {
      if (result.down === 1) return prefixed(result, pick(CHILD, gender));
      if (result.down === 2) return prefixed(result, pick(GRANDCHILD, gender));
      return prefixed(result, `${greats(result.down - 2)}${pick(GRANDCHILD, gender)}`);
    }

    case 'SIBLING':
      /**
       * No "half-".
       *
       * The engine still computes it, the export still carries it, and
       * genealogy software downstream still needs it. But it does not belong in
       * front of a family.
       *
       * In a household where one father has children with several mothers -
       * which is ordinary across much of the world and the norm in a good part
       * of Uganda - "half-brother" is an imported word that divides people who
       * have never thought of themselves as divided. The product's job is to
       * record who descends from whom, not to grade how much blood two people
       * share.
       */
      return pick(SIBLING, gender);

    case 'AUNT_UNCLE':
      return prefixed(result, `${greats(result.degree)}${pick(AUNT_UNCLE, gender)}`);

    case 'NIECE_NEPHEW':
      return prefixed(result, `${greats(result.degree)}${pick(NIBLING, gender)}`);

    case 'COUSIN': {
      const parts = [`${ordinal(result.degree)} cousin`, removal(result.removed)].filter(Boolean);
      return parts.join(' ');
    }

    case 'STEP_PARENT':
      return `step-${pick(PARENT, gender)}`;

    case 'STEP_CHILD':
      return `step-${pick(CHILD, gender)}`;

    case 'IN_LAW':
      return 'related by marriage';

    case 'UNRELATED':
    default:
      return 'not related by any recorded link';
  }
}

/** Adoption is stated rather than hidden - it is part of the family's history. */
function prefixed(result: RelationshipResult, term: string): string {
  return result.viaAdoption ? `adoptive ${term}` : term;
}

export const RELATIONSHIP_KIND_LABELS: Record<RelationshipKind, string> = {
  SELF: 'The same person',
  PARTNER: 'Partner',
  ANCESTOR: 'Ancestor',
  DESCENDANT: 'Descendant',
  SIBLING: 'Sibling',
  AUNT_UNCLE: 'Aunt or uncle',
  NIECE_NEPHEW: 'Niece or nephew',
  COUSIN: 'Cousin',
  STEP_PARENT: 'Step-parent',
  STEP_CHILD: 'Step-child',
  IN_LAW: 'By marriage',
  UNRELATED: 'No recorded link',
};