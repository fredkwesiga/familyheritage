import { z } from 'zod';

/**
 * Health contract.
 *
 * This lives in @fh/shared rather than inside the API so that the web client
 * validates the *same* schema the API promises. Every future endpoint follows
 * this pattern: schema here, inferred type here, used on both sides.
 */
export const healthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const dependencyHealthSchema = z.object({
  name: z.string(),
  status: healthStatusSchema,
  /** Round-trip time in milliseconds, when the check performed I/O. */
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});
export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string(),
  dependencies: z.array(dependencyHealthSchema),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
