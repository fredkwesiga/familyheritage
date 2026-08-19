import { z } from 'zod';
import { approximateDateSchema } from './dates.js';
import { memberSummarySchema } from './member.js';

/**
 * Story contracts.
 *
 * Stories are the point of the product. A tree of names and dates is a record;
 * a tree with stories in it is a family's history. Everything here is shaped by
 * one observation: the hardest thing about family history is not storing it, it
 * is getting anyone to write it down.
 */

export const storyVisibilitySchema = z.enum(['FAMILY', 'ADMINS_ONLY']);
export type StoryVisibility = z.infer<typeof storyVisibilitySchema>;

/**
 * Where the words came from.
 *
 * Recorded from the very first story, before any AI exists, because provenance
 * cannot be reconstructed later. A family reading a story two generations from
 * now is entitled to know whether their grandmother wrote it or a machine
 * arranged it.
 */
export const contentSourceSchema = z.enum([
  'HUMAN',
  'AI_ASSISTED_DRAFT',
  'AI_ASSISTED_APPROVED',
]);
export type ContentSource = z.infer<typeof contentSourceSchema>;

export const createStoryInputSchema = z.object({
  title: z.string().trim().min(1, 'Give the story a title').max(200),
  body: z.string().trim().min(1, 'A story needs something in it').max(50000),
  eventDate: approximateDateSchema.optional(),
  place: z.string().trim().max(160).optional(),
  visibility: storyVisibilitySchema.default('FAMILY'),
  /// Who this story is about. A story can belong to several people.
  memberIds: z.array(z.string().uuid()).max(50).default([]),
});
export type CreateStoryInput = z.infer<typeof createStoryInputSchema>;

export const updateStoryInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(50000),
    eventDate: approximateDateSchema,
    place: z.string().trim().max(160).nullable(),
    visibility: storyVisibilitySchema,
    memberIds: z.array(z.string().uuid()).max(50),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateStoryInput = z.infer<typeof updateStoryInputSchema>;

export const storySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),

  source: contentSourceSchema,
  /**
   * The rough notes an assisted story was built from, kept verbatim and
   * forever. The generated text never replaces what someone actually said.
   */
  originalNotes: z.string().nullable(),

  eventDate: approximateDateSchema.nullable(),
  place: z.string().nullable(),
  visibility: storyVisibilitySchema,

  /// Who the story is about.
  subjects: z.array(memberSummarySchema),

  authorName: z.string().nullable(),
  /// Whether the reader may edit this one - the author always may.
  canEdit: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Story = z.infer<typeof storySchema>;

export const storyResponseSchema = z.object({ story: storySchema });
export type StoryResponse = z.infer<typeof storyResponseSchema>;

export const storyListResponseSchema = z.object({ stories: z.array(storySchema) });
export type StoryListResponse = z.infer<typeof storyListResponseSchema>;

export const STORY_VISIBILITY_LABELS: Record<StoryVisibility, { label: string; hint: string }> = {
  FAMILY: {
    label: 'Everyone in the family',
    hint: 'Anyone who can see this family tree can read it.',
  },
  ADMINS_ONLY: {
    label: 'Only admins',
    hint: 'For anything the wider family should not read yet.',
  },
};

/**
 * Prompts for the blank page.
 *
 * The single biggest reason family history goes unwritten is not knowing where
 * to start. A prompt turns "write your family's history" - which nobody can
 * answer - into "what did their house look like?", which almost anyone can.
 */
export const STORY_PROMPTS = [
  'What is your clearest memory of them?',
  'What did they do for a living, and were they good at it?',
  'What did their home look like? What could you smell from the kitchen?',
  'What did they always say? Was there a phrase the family still repeats?',
  'Where did they move from, and why?',
  'What did they live through that you have only read about?',
  'What did they teach you, on purpose or otherwise?',
  'What would surprise their grandchildren?',
] as const;