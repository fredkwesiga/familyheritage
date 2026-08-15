import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a session.
 *
 * The guard is global and denies by default, so forgetting this decorator
 * makes a route inaccessible - a loud, harmless failure. The opposite default
 * (open unless protected) fails silently and leaks data.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);