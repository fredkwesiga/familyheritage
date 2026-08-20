import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MemberRow } from './member.mapper';

export interface SearchHit extends MemberRow {
  matchedOn: 'NAME' | 'MAIDEN_NAME' | 'OTHER_NAMES';
  score: number;
}

/**
 * Fuzzy member search, in SQL.
 *
 * Raw because Prisma cannot express pg_trgm's similarity operators, and those
 * operators are the entire point: a family searching for "Nakato" should find
 * Sarah, whose record says Nakato only in her name at birth, and searching
 * "Jon" should find John.
 *
 * Two things about how this is written:
 *
 * word_similarity rather than plain similarity. Comparing "jon" to the whole
 * string "John Kwesiga" scores badly because most of the string is unrelated;
 * word_similarity asks how well the query matches some word inside it, which is
 * what a person searching a name actually means.
 *
 * A prefix match is unioned in and scored highest. Someone typing "Kwe" is
 * navigating, not searching, and expects Kwesiga at the top immediately -
 * trigram similarity on a three-letter prefix is too weak to guarantee that.
 *
 * SECURITY: raw SQL bypasses the Prisma tenant guard, so familyId is bound
 * explicitly in every branch below. This is the one query in the application
 * where forgetting it would not throw.
 */
@Injectable()
export class MemberSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(familyId: string, query: string, limit: number): Promise<SearchHit[]> {
    const prefix = `${query}%`;
    const contains = `%${query}%`;

    return this.prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT
        m.*,
        CASE
          WHEN m."displayName" ILIKE ${prefix} THEN 'NAME'
          WHEN m."maidenName"  ILIKE ${contains} THEN 'MAIDEN_NAME'
          WHEN m."otherNames"  ILIKE ${contains} THEN 'OTHER_NAMES'
          WHEN word_similarity(${query}, m."displayName") >= 0.4 THEN 'NAME'
          WHEN word_similarity(${query}, COALESCE(m."maidenName", '')) >= 0.4 THEN 'MAIDEN_NAME'
          ELSE 'OTHER_NAMES'
        END AS "matchedOn",
        GREATEST(
          -- A prefix match outranks everything: the user is navigating.
          CASE WHEN m."displayName" ILIKE ${prefix} THEN 1.0 ELSE 0 END,
          CASE WHEN m."displayName" ILIKE ${contains} THEN 0.9 ELSE 0 END,
          word_similarity(${query}, m."displayName"),
          word_similarity(${query}, COALESCE(m."maidenName", '')) * 0.95,
          word_similarity(${query}, COALESCE(m."otherNames", '')) * 0.9
        ) AS score
      FROM "Member" m
      WHERE m."familyId" = ${familyId}::uuid
        AND m."deletedAt" IS NULL
        AND (
          m."displayName" ILIKE ${contains}
          OR m."maidenName" ILIKE ${contains}
          OR m."otherNames" ILIKE ${contains}
          OR word_similarity(${query}, m."displayName") >= 0.4
          OR word_similarity(${query}, COALESCE(m."maidenName", '')) >= 0.4
          OR word_similarity(${query}, COALESCE(m."otherNames", '')) >= 0.4
        )
      ORDER BY score DESC, m."displayName" ASC
      LIMIT ${limit}
    `);
  }
}