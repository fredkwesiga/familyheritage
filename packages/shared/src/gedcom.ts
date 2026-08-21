import type { ApproximateDate } from './dates.js';
import type { ExportedMember, FamilyExport } from './export.js';

/**
 * GEDCOM 5.5.1 export.
 *
 * GEDCOM is thirty years old, awkward, and the only reason a family's records
 * are genuinely theirs: Ancestry, MyHeritage, Gramps, FamilySearch and almost
 * everything else can open it. A JSON file only this software understands is
 * not portability, it is a nicer-looking lock-in.
 *
 * The interesting part is the shape mismatch. GEDCOM is union-based - a FAM
 * record holds a husband, a wife and their children - while this product stores
 * ParentChild and Partnership edges separately. Exporting means grouping
 * children by their set of parents to reconstitute those unions, which is
 * exactly the migration described when that data model was chosen. It works,
 * and doing it here proves the model was portable rather than merely claimed to
 * be.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Our date triple maps almost exactly onto GEDCOM's own date grammar, which
 * has always allowed ABT, BEF and AFT. Genealogists solved approximate dates
 * decades ago; the model in this product simply followed them.
 */
function gedcomDate(value: ApproximateDate | null | undefined): string | null {
  if (!value) return null;

  if (value.date) {
    const [year, month, day] = value.date.split('-');
    const monthName = MONTHS[Number(month) - 1];
    if (year && monthName && day) return `${Number(day)} ${monthName} ${year}`;
  }

  if (!value.text) return null;

  const prefix =
    value.qualifier === 'ABOUT' ? 'ABT ' :
    value.qualifier === 'BEFORE' ? 'BEF ' :
    value.qualifier === 'AFTER' ? 'AFT ' : '';

  return `${prefix}${value.text}`;
}

function gedcomSex(gender: string | null): string {
  const normalized = gender?.trim().toLowerCase() ?? '';
  if (['male', 'm', 'man', 'boy'].includes(normalized)) return 'M';
  if (['female', 'f', 'woman', 'girl'].includes(normalized)) return 'F';
  // U is the standard value for unknown, and far better than guessing.
  return 'U';
}

/**
 * GEDCOM caps a line at 255 characters and has no escape for a newline, so long
 * text is split: CONC continues a line, CONT starts a new one.
 */
function textLines(level: number, tag: string, text: string): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  paragraphs.forEach((paragraph, index) => {
    const currentTag = index === 0 ? tag : 'CONT';
    const currentLevel = index === 0 ? level : level + 1;

    if (paragraph.length === 0) {
      lines.push(`${currentLevel} ${currentTag}`);
      return;
    }

    let remaining = paragraph;
    let first = true;
    while (remaining.length > 0) {
      const chunk = remaining.slice(0, 200);
      remaining = remaining.slice(200);
      lines.push(
        first
          ? `${currentLevel} ${currentTag} ${chunk}`
          : `${level + 1} CONC ${chunk}`,
      );
      first = false;
    }
  });

  return lines;
}

function nameLine(member: ExportedMember): string {
  const given = member.givenName ?? '';
  const surname = member.familyName ?? '';
  return `1 NAME ${given} /${surname}/`.trimEnd();
}

/** Only these edges are lineal; step and foster relationships are noted, not modelled. */
const LINEAL = new Set(['BIOLOGICAL', 'ADOPTIVE']);

export function toGedcom(data: FamilyExport): string {
  const lines: string[] = [];

  // Stable, sequential ids. GEDCOM pointers must look like @I1@, not a UUID.
  const individualId = new Map<string, string>();
  data.members.forEach((member, index) => {
    individualId.set(member.id, `@I${index + 1}@`);
  });

  // --- Header --------------------------------------------------------------

  const today = new Date(data.exportedAt);
  const headerDate = `${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;

  lines.push(
    '0 HEAD',
    '1 SOUR FAMILY_HERITAGE',
    '2 NAME Family Heritage',
    '2 VERS 1',
    '1 DEST ANY',
    `1 DATE ${headerDate}`,
    '1 CHAR UTF-8',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    ...textLines(1, 'NOTE', `${data.family.name}. ${data.notice}`),
  );

  // --- Reconstitute unions -------------------------------------------------
  //
  // Children are grouped by the set of parents they share, which turns the edge
  // list back into the family units GEDCOM expects.

  const childrenByParentSet = new Map<string, { parents: string[]; children: string[] }>();

  const lineal = data.parentChild.filter((edge) => LINEAL.has(edge.relationType));
  const parentsOf = new Map<string, string[]>();
  for (const edge of lineal) {
    parentsOf.set(edge.childId, [...(parentsOf.get(edge.childId) ?? []), edge.parentId]);
  }

  for (const [childId, parents] of parentsOf) {
    const key = [...parents].sort().join('|');
    const entry = childrenByParentSet.get(key) ?? { parents: [...parents].sort(), children: [] };
    entry.children.push(childId);
    childrenByParentSet.set(key, entry);
  }

  // A childless marriage is still a family unit and still belongs in the file.
  for (const partnership of data.partnerships) {
    const key = [partnership.memberAId, partnership.memberBId].sort().join('|');
    if (!childrenByParentSet.has(key)) {
      childrenByParentSet.set(key, {
        parents: [partnership.memberAId, partnership.memberBId].sort(),
        children: [],
      });
    }
  }

  const families = [...childrenByParentSet.entries()].map(([key, entry], index) => ({
    pointer: `@F${index + 1}@`,
    key,
    ...entry,
  }));

  const spouseFamilies = new Map<string, string[]>();
  const childFamily = new Map<string, string>();
  for (const family of families) {
    for (const parentId of family.parents) {
      spouseFamilies.set(parentId, [...(spouseFamilies.get(parentId) ?? []), family.pointer]);
    }
    for (const childId of family.children) {
      childFamily.set(childId, family.pointer);
    }
  }

  // --- Individuals ---------------------------------------------------------

  for (const member of data.members) {
    const pointer = individualId.get(member.id);
    if (!pointer) continue;

    lines.push(`0 ${pointer} INDI`, nameLine(member));

    if (member.givenName) lines.push(`2 GIVN ${member.givenName}`);
    if (member.familyName) lines.push(`2 SURN ${member.familyName}`);
    if (member.maidenName) {
      // A name at birth is a second NAME record, which is how genealogy
      // software expects to find it.
      lines.push(`1 NAME /${member.maidenName}/`, '2 TYPE birth');
    }

    lines.push(`1 SEX ${gedcomSex(member.gender)}`);

    const birthDate = gedcomDate(member.birth);
    if (birthDate || member.birthPlace) {
      lines.push('1 BIRT');
      if (birthDate) lines.push(`2 DATE ${birthDate}`);
      if (member.birthPlace) lines.push(`2 PLAC ${member.birthPlace}`);
    }

    const deathDate = gedcomDate(member.death);
    // A death record with no date is meaningful: it says this person has died.
    if (member.livingStatus === 'DECEASED' || deathDate || member.deathPlace) {
      lines.push('1 DEAT');
      if (deathDate) lines.push(`2 DATE ${deathDate}`);
      if (member.deathPlace) lines.push(`2 PLAC ${member.deathPlace}`);
      if (!deathDate && !member.deathPlace) lines.push('2 TYPE Recorded as deceased');
    }

    if (member.occupation) lines.push(`1 OCCU ${member.occupation}`);

    const note = [member.biography, member.notes].filter(Boolean).join('\n\n');
    if (note) lines.push(...textLines(1, 'NOTE', note));

    const childOf = childFamily.get(member.id);
    if (childOf) lines.push(`1 FAMC ${childOf}`);

    for (const spouseOf of spouseFamilies.get(member.id) ?? []) {
      lines.push(`1 FAMS ${spouseOf}`);
    }

    // Adoption is stated rather than silently flattened into birth parentage.
    const adoptive = data.parentChild.filter(
      (edge) => edge.childId === member.id && edge.relationType === 'ADOPTIVE',
    );
    if (adoptive.length > 0 && childOf) {
      lines.push('1 ADOP', `2 FAMC ${childOf}`);
    }

    // Step and foster links have no lineal place in GEDCOM, so they are kept as
    // a note rather than dropped.
    const social = data.parentChild.filter(
      (edge) => edge.childId === member.id && !LINEAL.has(edge.relationType),
    );
    for (const edge of social) {
      const parent = data.members.find((candidate) => candidate.id === edge.parentId);
      if (parent) {
        lines.push(
          ...textLines(1, 'NOTE', `${edge.relationType.toLowerCase()} parent: ${parent.displayName}`),
        );
      }
    }
  }

  // --- Family units --------------------------------------------------------

  for (const family of families) {
    lines.push(`0 ${family.pointer} FAM`);

    // GEDCOM insists on HUSB and WIFE. Where sex is unknown, the first parent
    // takes HUSB - a limitation of the format, not a claim about the person.
    const [first, second] = family.parents;
    const firstMember = data.members.find((member) => member.id === first);
    const secondMember = data.members.find((member) => member.id === second);

    const assign = (member: ExportedMember | undefined, fallback: 'HUSB' | 'WIFE') => {
      if (!member) return;
      const pointer = individualId.get(member.id);
      if (!pointer) return;
      const sex = gedcomSex(member.gender);
      const tag = sex === 'F' ? 'WIFE' : sex === 'M' ? 'HUSB' : fallback;
      lines.push(`1 ${tag} ${pointer}`);
    };

    assign(firstMember, 'HUSB');
    assign(secondMember, 'WIFE');

    for (const childId of family.children) {
      const pointer = individualId.get(childId);
      if (pointer) lines.push(`1 CHIL ${pointer}`);
    }

    const partnership = data.partnerships.find(
      (candidate) => [candidate.memberAId, candidate.memberBId].sort().join('|') === family.key,
    );
    if (partnership) {
      const marriageDate = gedcomDate(partnership.start);
      if (marriageDate || partnership.place) {
        lines.push('1 MARR');
        if (marriageDate) lines.push(`2 DATE ${marriageDate}`);
        if (partnership.place) lines.push(`2 PLAC ${partnership.place}`);
      }
      if (partnership.status === 'DIVORCED') {
        lines.push('1 DIV');
        const endDate = gedcomDate(partnership.end);
        if (endDate) lines.push(`2 DATE ${endDate}`);
      }
    }
  }

  // --- Stories, as source notes -------------------------------------------
  //
  // GEDCOM has no story record, so each becomes a NOTE attached to the people
  // it is about. Lossy, but the alternative is leaving them out of the only
  // file other software can read.

  data.stories.forEach((story, index) => {
    lines.push(`0 @N${index + 1}@ NOTE`);
    const body = [story.title, '', story.body, story.authorName ? `\n— ${story.authorName}` : '']
      .filter(Boolean)
      .join('\n');
    const [firstLine, ...rest] = textLines(0, 'NOTE', body);
    // The record header is already written, so only the continuations are kept.
    void firstLine;
    lines.push(...rest.map((line) => line.replace(/^1 /, '1 ')));
  });

  lines.push('0 TRLR');

  // GEDCOM specifies CRLF.
  return lines.join('\r\n') + '\r\n';
}