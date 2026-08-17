import { Permission, roleHasPermission, type Member, type MemberSummary } from '@fh/shared';
import type { FamilyContext } from '../families/family.types';

/** The shape Prisma returns for a Member row. Kept loose so the mapper is testable. */
export interface MemberRow {
  id: string;
  familyId: string;
  givenName: string | null;
  familyName: string | null;
  otherNames: string | null;
  displayName: string;
  maidenName: string | null;
  gender: string | null;
  livingStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN';
  birthDate: Date | null;
  birthDateQualifier: 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'RANGE' | null;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDate: Date | null;
  deathDateQualifier: 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'RANGE' | null;
  deathDateText: string | null;
  deathPlace: string | null;
  causeOfDeath: string | null;
  biography: string | null;
  occupation: string | null;
  notes: string | null;
  primaryPhotoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const toIsoDate = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

/**
 * Decides whether a living person's details are withheld from this viewer.
 *
 * Recording family history means recording other living people's personal
 * data - their birth dates, occupations, sometimes their health - and those
 * people never agreed to any of it. The family setting exists so a family can
 * share its tree without also publishing its living relatives.
 *
 * Three ways to see the details: a role that permits it, the family setting
 * turned off, or the record being your own.
 */
export function shouldRedact(row: MemberRow, context: FamilyContext, hideLiving: boolean): boolean {
  if (row.livingStatus !== 'LIVING') return false;
  if (!hideLiving) return false;
  if (context.claimedMemberId === row.id) return false;
  return !roleHasPermission(context.role, Permission.LIVING_VIEW_DETAILS);
}

export function toMember(row: MemberRow, context: FamilyContext, hideLiving: boolean): Member {
  const redacted = shouldRedact(row, context, hideLiving);
  // Cause of death is sensitive on its own terms, independent of living status.
  const canSeeSensitive = roleHasPermission(context.role, Permission.SENSITIVE_VIEW);

  return {
    id: row.id,
    familyId: row.familyId,

    givenName: row.givenName,
    familyName: row.familyName,
    otherNames: redacted ? null : row.otherNames,
    displayName: row.displayName,
    maidenName: redacted ? null : row.maidenName,
    gender: redacted ? null : row.gender,

    livingStatus: row.livingStatus,

    // Names stay. Everything that amounts to a personal detail goes.
    birth: redacted
      ? null
      : {
          date: toIsoDate(row.birthDate),
          qualifier: row.birthDateQualifier,
          text: row.birthDateText,
        },
    birthPlace: redacted ? null : row.birthPlace,
    death: {
      date: toIsoDate(row.deathDate),
      qualifier: row.deathDateQualifier,
      text: row.deathDateText,
    },
    deathPlace: row.deathPlace,
    causeOfDeath: canSeeSensitive ? row.causeOfDeath : null,

    biography: redacted ? null : row.biography,
    occupation: redacted ? null : row.occupation,
    notes: redacted ? null : row.notes,

    primaryPhotoId: row.primaryPhotoId,

    isRedacted: redacted,
    isYou: context.claimedMemberId === row.id,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function toMemberSummary(
  row: MemberRow,
  context: FamilyContext,
  hideLiving: boolean,
): MemberSummary {
  const full = toMember(row, context, hideLiving);
  return {
    id: full.id,
    displayName: full.displayName,
    givenName: full.givenName,
    familyName: full.familyName,
    maidenName: full.maidenName,
    gender: full.gender,
    livingStatus: full.livingStatus,
    birth: full.birth,
    death: full.death,
    primaryPhotoId: full.primaryPhotoId,
    isRedacted: full.isRedacted,
    isYou: full.isYou,
    deletedAt: full.deletedAt,
  };
}

/**
 * Builds the displayName from the parts.
 *
 * Stored rather than computed on read because it is what fuzzy search indexes
 * (the trigram index from Phase 2) and what the tree renders. Recomputed on
 * every write so it can never drift from the name fields.
 */
export function deriveDisplayName(parts: {
  givenName?: string | null;
  familyName?: string | null;
}): string {
  const joined = [parts.givenName?.trim(), parts.familyName?.trim()].filter(Boolean).join(' ');
  return joined || 'Unnamed';
}