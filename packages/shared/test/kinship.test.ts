import { describe, expect, it } from 'vitest';
import { areHalfSiblings, buildFamilyGraph, computeRelationship } from '../src/kinship.js';
import { describeRelationship } from '../src/kinship-labels.js';
import { kwesigaGraph, P } from './fixture.js';


const graph = kwesigaGraph();

/** How is `other` related to `subject`? */
const rel = (subject: string, other: string) => computeRelationship(graph, subject, other);
const say = (subject: string, other: string, gender?: string) =>
  describeRelationship(rel(subject, other), gender);

describe('direct lineage', () => {
  it('parent and child', () => {
    expect(rel(P.fred, P.john).kind).toBe('ANCESTOR');
    expect(rel(P.fred, P.john).up).toBe(1);
    expect(say(P.fred, P.john, 'male')).toBe('father');

    expect(rel(P.john, P.fred).kind).toBe('DESCENDANT');
    expect(say(P.john, P.fred, 'male')).toBe('son');
  });

  it('grandparent and grandchild', () => {
    expect(rel(P.fred, P.peter)).toMatchObject({ kind: 'ANCESTOR', up: 2 });
    expect(say(P.fred, P.peter, 'male')).toBe('grandfather');
    expect(say(P.peter, P.fred, 'male')).toBe('grandson');
  });

  it('great-grandparent, three generations up', () => {
    expect(say(P.fred, P.yusuf, 'male')).toBe('great-grandfather');
  });

  it('five generations, from Isaac to Yusuf', () => {
    expect(rel(P.isaac, P.yusuf)).toMatchObject({ kind: 'ANCESTOR', up: 4 });
    expect(say(P.isaac, P.yusuf, 'male')).toBe('great-great-grandfather');
  });
});

describe('siblings', () => {
  it('full siblings share both parents', () => {
    expect(rel(P.fred, P.miriam)).toMatchObject({ kind: 'SIBLING', half: false });
    expect(say(P.fred, P.miriam, 'female')).toBe('sister');
  });

  it('half-siblings share one parent', () => {
    // John and Moses share Peter and nothing else.
    expect(rel(P.john, P.moses)).toMatchObject({ kind: 'SIBLING', half: true });
    expect(say(P.john, P.moses, 'male')).toBe('half-brother');
  });

  it('is symmetric', () => {
    expect(rel(P.moses, P.john).half).toBe(true);
    expect(rel(P.miriam, P.fred).half).toBe(false);
  });

  it('does NOT treat step-parentage as shared ancestry', () => {
    // Esther is Moses's biological mother and John's STEP-mother. If step edges
    // counted, John and Moses would look like full siblings through her.
    expect(rel(P.john, P.moses).half).toBe(true);
    expect(rel(P.john, P.moses).commonAncestorIds).toEqual([P.peter]);
  });

    it('does NOT claim half when only one parent is recorded for either', () => {
    // The ordinary case for a family recording what they know: one parent
    // entered, two children hung off them. They meant siblings, and telling
    // them otherwise is an assertion about their family they never made.
    const solo = buildFamilyGraph({
      parentChild: [
        { parentId: 'mother', childId: 'a', relationType: 'BIOLOGICAL' },
        { parentId: 'mother', childId: 'b', relationType: 'BIOLOGICAL' },
      ],
      partnerships: [],
    });
    expect(computeRelationship(solo, 'a', 'b')).toMatchObject({ kind: 'SIBLING', half: false });
    expect(areHalfSiblings(solo, 'a', 'b')).toBe(false);
  });

  it('claims half only when a second, different parent is on record', () => {
    const evidenced = buildFamilyGraph({
      parentChild: [
        { parentId: 'dad', childId: 'a', relationType: 'BIOLOGICAL' },
        { parentId: 'mum', childId: 'a', relationType: 'BIOLOGICAL' },
        { parentId: 'dad', childId: 'b', relationType: 'BIOLOGICAL' },
        { parentId: 'stepmum', childId: 'b', relationType: 'BIOLOGICAL' },
      ],
      partnerships: [],
    });
    expect(areHalfSiblings(evidenced, 'a', 'b')).toBe(true);
  });
});

describe('aunts, uncles, nieces and nephews', () => {
  it('aunt and niece', () => {
    expect(rel(P.fred, P.grace)).toMatchObject({ kind: 'AUNT_UNCLE', degree: 0 });
    expect(say(P.fred, P.grace, 'female')).toBe('aunt');

    expect(rel(P.grace, P.fred)).toMatchObject({ kind: 'NIECE_NEPHEW', degree: 0 });
    expect(say(P.grace, P.fred, 'male')).toBe('nephew');
  });

  it('half-uncle: Moses is a half-brother of Fred\u2019s father', () => {
    expect(rel(P.fred, P.moses).kind).toBe('AUNT_UNCLE');
    expect(say(P.fred, P.moses, 'male')).toBe('uncle');
  });

  it('great-aunt', () => {
    // Daniel is a brother of Fred's grandfather Peter.
    expect(rel(P.fred, P.daniel)).toMatchObject({ kind: 'AUNT_UNCLE', degree: 1 });
    expect(say(P.fred, P.daniel, 'male')).toBe('great-uncle');
  });
});

describe('cousins', () => {
  it('first cousins: John and Robert', () => {
    // John's parent Peter and Robert's parent Sarah are siblings.
    expect(rel(P.john, P.robert)).toMatchObject({ kind: 'COUSIN', degree: 1, removed: 0 });
    expect(say(P.john, P.robert)).toBe('first cousin');
  });

  it('second cousins: Fred and David', () => {
    expect(rel(P.fred, P.david)).toMatchObject({ kind: 'COUSIN', degree: 2, removed: 0 });
    expect(say(P.fred, P.david)).toBe('second cousin');
  });

  it('first cousin once removed: John and David', () => {
    expect(rel(P.john, P.david)).toMatchObject({ kind: 'COUSIN', degree: 1, removed: 1 });
    expect(say(P.john, P.david)).toBe('first cousin once removed');
  });

  it('removal is symmetric', () => {
    expect(rel(P.david, P.john)).toMatchObject({ degree: 1, removed: 1 });
  });
});

describe('adoption', () => {
  it('records an adoptive path and says so', () => {
    expect(rel(P.anna, P.grace)).toMatchObject({ kind: 'ANCESTOR', viaAdoption: true });
    expect(say(P.anna, P.grace, 'female')).toBe('adoptive mother');
  });

  it('carries adoption through to wider kin', () => {
    // Anna is adopted by Grace, so Grace's brother John is her uncle.
    expect(rel(P.anna, P.john)).toMatchObject({ kind: 'AUNT_UNCLE', viaAdoption: true });
  });

  it('does not mark unrelated-by-adoption paths', () => {
    expect(rel(P.fred, P.miriam).viaAdoption).toBe(false);
  });
});

describe('multiple common ancestors', () => {
  it('returns both shared parents, not just one', () => {
    const result = rel(P.fred, P.miriam);
    expect(result.commonAncestorIds).toHaveLength(2);
    expect(result.commonAncestorIds).toEqual(expect.arrayContaining([P.john, P.ruth]));
  });

  it('returns both grandparents for cousins', () => {
    expect(rel(P.john, P.robert).commonAncestorIds).toEqual(
      expect.arrayContaining([P.yusuf, P.amina]),
    );
  });
});

describe('by marriage', () => {
  it('partner', () => {
    expect(rel(P.john, P.ruth).kind).toBe('PARTNER');
    expect(say(P.john, P.ruth, 'female')).toBe('wife');
  });

  it('step-parent through a parent\u2019s remarriage', () => {
    // Esther married Peter after Josephine died. She is not John's ancestor.
    const result = rel(P.john, P.esther);
    expect(result.kind).toBe('STEP_PARENT');
    expect(result.viaMemberId).toBe(P.peter);
    expect(say(P.john, P.esther, 'female')).toBe('step-mother');
  });

  it('in-law', () => {
    // Samuel is married to Grace, who is Fred's aunt.
    expect(rel(P.fred, P.samuel).kind).toBe('IN_LAW');
  });

  it('blood wins over marriage when both exist', () => {
    // Peter is Moses's father, and also married to Moses's mother.
    expect(rel(P.moses, P.peter).kind).toBe('ANCESTOR');
  });
});

describe('unknown and absent links', () => {
  it('reaches ancestors through a single recorded parent', () => {
    // Robert's father was never recorded, but his mother Sarah connects him to
    // the whole line above her.
    expect(rel(P.robert, P.yusuf).kind).toBe('ANCESTOR');
  });

  it('someone who married in is related by marriage, not by blood', () => {
    // Ruth has no blood tie to Yusuf, but she married his grandson - so there
    // is a real connection, and calling it UNRELATED would be wrong.
    const result = rel(P.ruth, P.yusuf);
    expect(result.kind).toBe('IN_LAW');
    expect(result.commonAncestorIds).toEqual([]);
  });

  it('does not chain marriage to marriage', () => {
    // Ruth's husband's sister's husband is not Ruth's relative. Following that
    // chain would eventually connect everyone in the tree to everyone else.
    expect(rel(P.ruth, P.samuel).kind).toBe('UNRELATED');
  });

  it('two people with nothing between them', () => {
    expect(rel(P.ruth, P.samuel).kind).toBe('UNRELATED');
    expect(say(P.ruth, P.samuel)).toBe('not related by any recorded link');
  });

  it('self', () => {
    expect(rel(P.fred, P.fred).kind).toBe('SELF');
  });
});

describe('corrupt data does not hang the engine', () => {
  it('terminates on a cycle', () => {
    // The API prevents this, but a bad import or a manual edit could create it,
    // and a hung request is worse than a wrong answer.
    const cyclic = buildFamilyGraph({
      parentChild: [
        { parentId: 'a', childId: 'b', relationType: 'BIOLOGICAL' },
        { parentId: 'b', childId: 'c', relationType: 'BIOLOGICAL' },
        { parentId: 'c', childId: 'a', relationType: 'BIOLOGICAL' },
      ],
      partnerships: [],
    });
    const result = computeRelationship(cyclic, 'a', 'b');
    expect(result.kind).toBeDefined();
  });

  it('handles a member who is not in the graph at all', () => {
    expect(rel(P.fred, 'nobody').kind).toBe('UNRELATED');
  });
});

describe('kinship terminology', () => {
  it('western: a parent’s cousin is a cousin once removed', () => {
    expect(say(P.fred, P.david)).toBe('second cousin');
    expect(describeRelationship(rel(P.john, P.david), 'male', 'WESTERN')).toBe(
      'first cousin once removed',
    );
  });

  it('classificatory: the same person is an uncle', () => {
    // How a great many families actually speak. The engine returns the same
    // cousin(1,1) either way - only the word changes.
    expect(describeRelationship(rel(P.david, P.john), 'male', 'CLASSIFICATORY')).toBe('uncle');
    expect(describeRelationship(rel(P.john, P.david), 'male', 'CLASSIFICATORY')).toBe('nephew');
  });

  it('classificatory: cousins are brothers and sisters', () => {
    expect(describeRelationship(rel(P.fred, P.david), 'male', 'CLASSIFICATORY')).toBe('brother');
  });

  it('neither style changes the computed relationship', () => {
    const result = rel(P.john, P.david);
    expect(result).toMatchObject({ kind: 'COUSIN', degree: 1, removed: 1 });
  });
});

describe('invariants', () => {
  const everyone = Object.values(P);

  it('is symmetric in kind: ancestors mirror descendants', () => {
    for (const a of everyone) {
      for (const b of everyone) {
        if (a === b) continue;
        const forward = rel(a, b);
        const back = rel(b, a);
        if (forward.kind === 'ANCESTOR') expect(back.kind).toBe('DESCENDANT');
        if (forward.kind === 'AUNT_UNCLE') expect(back.kind).toBe('NIECE_NEPHEW');
        if (forward.kind === 'SIBLING') expect(back.kind).toBe('SIBLING');
        if (forward.kind === 'COUSIN') expect(back.kind).toBe('COUSIN');
      }
    }
  });

  it('never reports anyone as their own ancestor', () => {
    for (const person of everyone) {
      expect(rel(person, person).kind).toBe('SELF');
    }
  });

  it('agrees on distance in both directions', () => {
    for (const a of everyone) {
      for (const b of everyone) {
        const forward = rel(a, b);
        const back = rel(b, a);
        if (forward.kind === 'COUSIN' && back.kind === 'COUSIN') {
          expect(forward.degree).toBe(back.degree);
          expect(forward.removed).toBe(back.removed);
        }
      }
    }
  });
});