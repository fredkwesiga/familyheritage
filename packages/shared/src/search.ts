import { z } from 'zod';
import { memberSummarySchema } from './member.js';

/**
 * Member search.
 *
 * Genealogical names are misspelled constantly, transliterated inconsistently,
 * and change across generations - a woman may appear as Nakato, Nakato-Kwesiga
 * and Kwesiga in three different records of the same family. Exact matching is
 * close to useless here, which is why the trigram index went into the schema in
 * Phase 2 and why this is fuzzy by default rather than as a fallback.
 */

/** Two characters. One matches most of a family and helps nobody. */
export const MIN_SEARCH_LENGTH = 2;

export const memberSearchQuerySchema = z.object({
  q: z.string().trim().min(MIN_SEARCH_LENGTH).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type MemberSearchQuery = z.infer<typeof memberSearchQuerySchema>;

export const memberSearchResultSchema = z.object({
  member: memberSummarySchema,
  /**
   * Which field matched.
   *
   * Shown in the results, because "why is this here?" is a real question when a
   * search for Nakato returns someone listed as Sarah Kwesiga - the answer being
   * that Nakato was her name at birth.
   */
  matchedOn: z.enum(['NAME', 'MAIDEN_NAME', 'OTHER_NAMES']),
  /** 0-1. Used only for ordering; never shown. */
  score: z.number(),
});
export type MemberSearchResult = z.infer<typeof memberSearchResultSchema>;

export const memberSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(memberSearchResultSchema),
});
export type MemberSearchResponse = z.infer<typeof memberSearchResponseSchema>;

export const MATCH_LABELS: Record<MemberSearchResult['matchedOn'], string | null> = {
  // The ordinary case needs no explanation.
  NAME: null,
  MAIDEN_NAME: 'name at birth',
  OTHER_NAMES: 'also known as',
};