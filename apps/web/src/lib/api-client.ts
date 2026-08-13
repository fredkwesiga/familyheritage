import type { ZodSchema } from 'zod';
import { apiErrorSchema, type ApiErrorBody } from '@fh/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * A typed error the whole UI can branch on, instead of a bare Error string.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: ApiErrorBody['issues'],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * The only place in the client that calls fetch().
 *
 * Two things it guarantees:
 *  - credentials: 'include' on every request, so the httpOnly session cookie
 *    added in Phase 3 works without touching a single call site.
 *  - the response is parsed with the same Zod schema the API validated against,
 *    so a contract drift surfaces immediately instead of as `undefined` deep in
 *    a component.
 */
export async function apiRequest<T>(
  path: string,
  schema: ZodSchema<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(
        parsed.data.statusCode,
        parsed.data.code,
        parsed.data.message,
        parsed.data.issues,
        parsed.data.requestId,
      );
    }
    throw new ApiError(response.status, 'INTERNAL', `Request failed (${response.status}).`);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(
      response.status,
      'INTERNAL',
      'The server returned data in an unexpected format.',
    );
  }
  return result.data;
}
