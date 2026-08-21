import { describe, expect, it } from 'vitest';
import { EXPORT_NOTICE, type FamilyExport } from '../src/export.js';
import { toGedcom } from '../src/gedcom.js';

const EMPTY = { date: null, qualifier: null, text: null };

function member(overrides: Partial<FamilyExport['members'][number]>) {
  return {
    id: 'x',
    givenName: null,
    familyName: null,
    otherNames: null,
    maidenName: null,
    displayName: 'Unnamed',
    gender: null,
    livingStatus: 'UNKNOWN' as const,
    birth: EMPTY,
    birthPlace: null,
    death: EMPTY,
    deathPlace: null,
    occupation: null,
    biography: null,
    notes: null,
    ...overrides,
  };
}

function exportOf(partial: Partial<FamilyExport>): FamilyExport {
  return {
    format: 'family-heritage-export',
    formatVersion: 1,
    exportedAt: '2026-08-20T00:00:00.000Z',
    exportedBy: 'Fred Kwesiga',
    family: { id: 'f1', name: 'The Kwesiga Family', description: null, createdAt: '2026-01-01' },
    members: [],
    parentChild: [],
    partnerships: [],
    stories: [],
    photos: [],
    notice: EXPORT_NOTICE,
    ...partial,
  };
}

describe('GEDCOM structure', () => {
  it('opens with a header and closes with a trailer', () => {
    const output = toGedcom(exportOf({}));
    expect(output.startsWith('0 HEAD')).toBe(true);
    expect(output.trimEnd().endsWith('0 TRLR')).toBe(true);
    expect(output).toContain('2 VERS 5.5.1');
  });

  it('uses CRLF, as the specification requires', () => {
    expect(toGedcom(exportOf({}))).toContain('\r\n');
  });
});

describe('individuals', () => {
  it('writes a name in GEDCOM form', () => {
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'a', givenName: 'Peter', familyName: 'Kwesiga' })],
      }),
    );
    expect(output).toContain('1 NAME Peter /Kwesiga/');
    expect(output).toContain('2 GIVN Peter');
    expect(output).toContain('2 SURN Kwesiga');
  });

  it('records a name at birth as a second NAME', () => {
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'a', givenName: 'Sarah', familyName: 'Kwesiga', maidenName: 'Nakato' })],
      }),
    );
    expect(output).toContain('1 NAME /Nakato/');
    expect(output).toContain('2 TYPE birth');
  });

  it('writes U for unknown sex rather than guessing', () => {
    const output = toGedcom(exportOf({ members: [member({ id: 'a', gender: null })] }));
    expect(output).toContain('1 SEX U');
  });
});

describe('approximate dates', () => {
  it('an exact date becomes a GEDCOM date', () => {
    const output = toGedcom(
      exportOf({
        members: [
          member({ id: 'a', birth: { date: '1901-06-12', qualifier: 'EXACT', text: null } }),
        ],
      }),
    );
    expect(output).toContain('2 DATE 12 JUN 1901');
  });

  it('"about 1936" becomes ABT 1936', () => {
    // GEDCOM solved approximate dates decades ago; our model followed it, and
    // this is where that pays off.
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'a', birth: { date: null, qualifier: 'ABOUT', text: '1936' } })],
      }),
    );
    expect(output).toContain('2 DATE ABT 1936');
  });

  it('"before 1945" becomes BEF 1945', () => {
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'a', death: { date: null, qualifier: 'BEFORE', text: '1945' } })],
      }),
    );
    expect(output).toContain('2 DATE BEF 1945');
  });

  it('records a death with no date at all', () => {
    // The common case in real family history, and the one most software
    // refuses to represent.
    const output = toGedcom(
      exportOf({ members: [member({ id: 'a', livingStatus: 'DECEASED' })] }),
    );
    expect(output).toContain('1 DEAT');
  });
});

describe('reconstituting family units', () => {
  it('groups children by their shared parents', () => {
    const output = toGedcom(
      exportOf({
        members: [
          member({ id: 'dad', givenName: 'Peter', gender: 'male' }),
          member({ id: 'mum', givenName: 'Josephine', gender: 'female' }),
          member({ id: 'kid1', givenName: 'John' }),
          member({ id: 'kid2', givenName: 'Grace' }),
        ],
        parentChild: [
          { parentId: 'dad', childId: 'kid1', relationType: 'BIOLOGICAL' },
          { parentId: 'mum', childId: 'kid1', relationType: 'BIOLOGICAL' },
          { parentId: 'dad', childId: 'kid2', relationType: 'BIOLOGICAL' },
          { parentId: 'mum', childId: 'kid2', relationType: 'BIOLOGICAL' },
        ],
      }),
    );

    // One FAM for the couple, carrying both children.
    expect(output.match(/^0 @F\d+@ FAM$/gm)).toHaveLength(1);
    expect(output.match(/^1 CHIL /gm)).toHaveLength(2);
    expect(output).toContain('1 HUSB');
    expect(output).toContain('1 WIFE');
  });

  it('a remarriage produces a second family unit', () => {
    const output = toGedcom(
      exportOf({
        members: [
          member({ id: 'dad', gender: 'male' }),
          member({ id: 'wife1', gender: 'female' }),
          member({ id: 'wife2', gender: 'female' }),
          member({ id: 'kid1' }),
          member({ id: 'kid2' }),
        ],
        parentChild: [
          { parentId: 'dad', childId: 'kid1', relationType: 'BIOLOGICAL' },
          { parentId: 'wife1', childId: 'kid1', relationType: 'BIOLOGICAL' },
          { parentId: 'dad', childId: 'kid2', relationType: 'BIOLOGICAL' },
          { parentId: 'wife2', childId: 'kid2', relationType: 'BIOLOGICAL' },
        ],
      }),
    );
    expect(output.match(/^0 @F\d+@ FAM$/gm)).toHaveLength(2);
  });

  it('keeps a childless marriage', () => {
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'a', gender: 'male' }), member({ id: 'b', gender: 'female' })],
        partnerships: [
          {
            memberAId: 'a',
            memberBId: 'b',
            type: 'MARRIAGE',
            status: 'ACTIVE',
            start: { date: '1956-12-15', qualifier: 'EXACT', text: null },
            end: EMPTY,
            place: 'Masaka, Uganda',
          },
        ],
      }),
    );
    expect(output).toContain('1 MARR');
    expect(output).toContain('2 DATE 15 DEC 1956');
    expect(output).toContain('2 PLAC Masaka, Uganda');
  });

  it('a single recorded parent still forms a family unit', () => {
    // Robert's father was never recorded. GEDCOM handles this; a schema with
    // father_id and mother_id would have had to invent someone.
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'mum', gender: 'female' }), member({ id: 'kid' })],
        parentChild: [{ parentId: 'mum', childId: 'kid', relationType: 'BIOLOGICAL' }],
      }),
    );
    expect(output).toContain('1 WIFE');
    expect(output).toContain('1 CHIL');
    expect(output).not.toContain('1 HUSB');
  });
});

describe('relationships GEDCOM cannot express directly', () => {
  it('marks adoption', () => {
    const output = toGedcom(
      exportOf({
        members: [member({ id: 'mum', gender: 'female' }), member({ id: 'kid' })],
        parentChild: [{ parentId: 'mum', childId: 'kid', relationType: 'ADOPTIVE' }],
      }),
    );
    expect(output).toContain('1 ADOP');
  });

  it('keeps a step-parent as a note rather than dropping it', () => {
    const output = toGedcom(
      exportOf({
        members: [
          member({ id: 'step', displayName: 'Esther Kwesiga', gender: 'female' }),
          member({ id: 'kid', displayName: 'John Kwesiga' }),
        ],
        parentChild: [{ parentId: 'step', childId: 'kid', relationType: 'STEP' }],
      }),
    );
    expect(output).toContain('step parent: Esther Kwesiga');
  });
});

describe('long text', () => {
  it('splits paragraphs with CONT', () => {
    const output = toGedcom(
      exportOf({ members: [member({ id: 'a', biography: 'First line.\nSecond line.' })] }),
    );
    expect(output).toContain('1 NOTE First line.');
    expect(output).toContain('2 CONT Second line.');
  });

  it('splits an over-long line with CONC', () => {
    const output = toGedcom(
      exportOf({ members: [member({ id: 'a', biography: 'x'.repeat(500) })] }),
    );
    expect(output).toContain('2 CONC');
    // No line may exceed the GEDCOM limit.
    for (const line of output.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(255);
    }
  });
});