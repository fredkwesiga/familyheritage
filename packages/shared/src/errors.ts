import { z } from 'zod';

/**
 * Every non-2xx response from the API has this shape. One error envelope for
 * the whole surface means the web client needs exactly one error handler.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  /** Stable machine-readable code, e.g. 'VALIDATION_FAILED'. */
  code: z.string(),
  /** Human-readable message. Safe to show to a user. */
  message: z.string(),
  /** Field-level validation problems, when applicable. */
  issues: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  /** Correlates a user-facing error with a server log line. */
  requestId: z.string().optional(),
  timestamp: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
