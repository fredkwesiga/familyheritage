import { z } from 'zod';

/**
 * The single source of truth for configuration.
 *
 * The process refuses to boot if any of this is wrong. A missing DATABASE_URL
 * should be a five-second failure at startup, not a confusing 500 three days
 * later. Adding a new environment variable means adding it here, to
 * .env.example, and to the table in README.md - nowhere else.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /// Public base URL of the WEB client. Magic-link and password-reset emails
  /// point here, so it must be the address the user's browser can actually reach.
  APP_URL: z.string().url().default('http://localhost:5173'),

  /// How long a session cookie stays valid. 30 days keeps older relatives from
  /// being logged out between visits, which is a real contribution killer.
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  /// Magic links and reset links. Short on purpose - they arrive in an inbox.
  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(20),

  /// 'console' prints emails to the server log. Phase 14 adds a real transport.
  EMAIL_TRANSPORT: z.enum(['console', 'brevo', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('Family Heritage <noreply@localhost>'),
  EMAIL_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // AI is off by default at every level: environment, family setting, and UI.
  AI_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-4-6'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule.forRoot({ validate }). Nest calls this once at boot.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}\n`);
  }

  // Fail loudly on a combination that is individually valid but jointly broken.
  if (parsed.data.AI_ENABLED && !parsed.data.AI_API_KEY) {
    throw new Error('Invalid environment configuration:\n  - AI_ENABLED=true requires AI_API_KEY\n');
  }

  if (parsed.data.EMAIL_TRANSPORT !== 'console' && !parsed.data.EMAIL_API_KEY) {
    throw new Error(
      `Invalid environment configuration:\n  - EMAIL_TRANSPORT=${parsed.data.EMAIL_TRANSPORT} requires EMAIL_API_KEY\n`,
    );
  }

  return parsed.data;
}