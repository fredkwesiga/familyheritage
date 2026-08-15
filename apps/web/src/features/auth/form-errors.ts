import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api-client';

/**
 * Maps server-side validation issues back onto the right form fields, so a
 * rejected email lands under the email input rather than in a banner at the top
 * where the user has to work out which field it refers to.
 *
 * Returns the message that should be shown at form level, if any.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Check your connection and try again.';
  }

  if (error.issues?.length) {
    let matchedAny = false;
    for (const issue of error.issues) {
      if (issue.path) {
        setError(issue.path as Path<T>, { type: 'server', message: issue.message });
        matchedAny = true;
      }
    }
    if (matchedAny) return '';
  }

  return error.message;
}