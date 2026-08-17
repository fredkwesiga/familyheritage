import { z } from 'zod';

/**
 * Approximate dates.
 *
 * Genealogy is the science of incomplete information. "circa 1890", "before the
 * war", "sometime in the 1940s" are normal inputs, not edge cases, so every
 * date in this product is a triple rather than a column.
 *
 * THE INVARIANT: `date` means "we know this exact day". Anything less certain
 * leaves it null and lives in `qualifier` + `text`. That is what stops
 * "about 1936" from silently rendering as "1 January 1936" on a memorial page.
 */
export const dateQualifierSchema = z.enum(['EXACT', 'ABOUT', 'BEFORE', 'AFTER', 'RANGE']);
export type DateQualifier = z.infer<typeof dateQualifierSchema>;

/**
 * Deliberately permissive.
 *
 * An earlier version required completeness - an EXACT qualifier had to have a
 * day, an ABOUT qualifier had to have text. That is correct for stored data and
 * wrong for a form, because a form is necessarily incomplete while someone is
 * filling it in: the moment they choose "exact date" there is a qualifier and
 * no day yet. Rejecting that state blocked submission with no way to say why.
 *
 * So the schema accepts partial values and `normalizeDate` below collapses them
 * on the way out. The invariant is enforced there instead.
 */
export const approximateDateSchema = z.object({
  /** ISO yyyy-mm-dd. Only ever set when the exact day is known. */
  date: z.string().date().nullable(),
  qualifier: dateQualifierSchema.nullable(),
  /** What the family actually said: "circa 1901", "before the war". */
  text: z.string().trim().max(100).nullable(),
});

export type ApproximateDate = z.infer<typeof approximateDateSchema>;

/**
 * All three fields are required, with no Zod defaults, on purpose.
 *
 * A schema with .default() has an input type that differs from its output type,
 * and that divergence silently breaks two things downstream: type inference in
 * the API client (which infers T from ZodSchema<T>), and zodResolver in every
 * form that touches a date. Requiring all three keys and exporting EMPTY_DATE
 * for the "nothing recorded" case costs one import and keeps both honest.
 */
export const EMPTY_DATE: ApproximateDate = { date: null, qualifier: null, text: null };

/**
 * Collapses a half-finished date to "nothing recorded".
 *
 * A qualifier with no date and no text carries no information, so it becomes
 * EMPTY_DATE rather than being stored as a meaningless fragment. Call this at
 * every form boundary, immediately before sending to the API.
 */
export function normalizeDate(value: ApproximateDate | null | undefined): ApproximateDate {
  if (!value) return EMPTY_DATE;

  const text = value.text?.trim() || null;

  // An exact date is the only case that keeps `date`.
  if (value.qualifier === 'EXACT') {
    return value.date ? { date: value.date, qualifier: 'EXACT', text: null } : EMPTY_DATE;
  }

  // Anything approximate lives entirely in the text.
  if (value.qualifier && text) {
    return { date: null, qualifier: value.qualifier, text };
  }

  // A stray date with no qualifier is still a known day.
  if (value.date) return { date: value.date, qualifier: 'EXACT', text: null };

  // Text with no qualifier is still worth keeping.
  if (text) return { date: null, qualifier: 'ABOUT', text };

  return EMPTY_DATE;
}

/** True when nothing at all is recorded. */
export function isDateEmpty(value: ApproximateDate | null | undefined): boolean {
  return !value || (!value.date && !value.text);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Renders a date for a human.
 *
 * `text` wins whenever the date is not exact, because the family's own wording
 * is more honest than anything we could synthesise from a partial value.
 */
export function formatApproximateDate(value: ApproximateDate | null | undefined): string {
  if (isDateEmpty(value)) return '';
  if (!value) return '';

  if (value.qualifier && value.qualifier !== 'EXACT') {
    if (value.text) {
      const prefix =
        value.qualifier === 'ABOUT' ? 'c. ' :
        value.qualifier === 'BEFORE' ? 'before ' :
        value.qualifier === 'AFTER' ? 'after ' : '';
      // Don't double up when the family already wrote "about 1936".
      return value.text.toLowerCase().startsWith(prefix.trim().toLowerCase()) || !prefix
        ? value.text
        : `${prefix}${value.text}`;
    }
  }

  if (value.date) {
    const [year, month, day] = value.date.split('-');
    const monthName = MONTHS[Number(month) - 1];
    if (year && monthName && day) return `${Number(day)} ${monthName} ${year}`;
  }

  return value.text ?? '';
}

/** The year, for the life-dates line. Falls back to digging one out of the text. */
export function yearOf(value: ApproximateDate | null | undefined): string | null {
  if (!value) return null;
  if (value.date) return value.date.slice(0, 4);
  if (value.text) {
    const match = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(value.text);
    if (match) {
      const year = match[1];
      return value.qualifier === 'ABOUT' ? `c. ${year}` : (year ?? null);
    }
  }
  return null;
}

/**
 * The line under a name on a member card: "1921 – 1998", "b. 1988", "d. 1974".
 *
 * This carries the whole weight of communicating that someone has died, because
 * grayscale alone does not: many of the most important photographs in a family
 * archive are already black and white, so the filter conveys nothing for exactly
 * the generation it is meant to honour. It is also the only signal a screen
 * reader can convey.
 */
export function formatLifeDates(
  birth: ApproximateDate | null | undefined,
  death: ApproximateDate | null | undefined,
  livingStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN',
): string {
  const birthYear = yearOf(birth);
  const deathYear = yearOf(death);

  if (livingStatus === 'DECEASED') {
    if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
    if (birthYear) return `${birthYear} – unknown`;
    if (deathYear) return `d. ${deathYear}`;
    return 'Dates unknown';
  }

  if (birthYear) return `b. ${birthYear}`;
  return '';
}