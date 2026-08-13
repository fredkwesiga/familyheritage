import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';
import { ErrorCode } from '@fh/shared';

/**
 * Validates a request body/query/param against a Zod schema from @fh/shared.
 *
 * We use Zod rather than class-validator so that exactly one schema definition
 * serves API validation, API types, and React Hook Form validation on the
 * client. No decorators to keep in sync with an interface.
 *
 * Usage (from Phase 3 onward):
 *   @Post()
 *   create(@Body(new ZodValidationPipe(createFamilySchema)) dto: CreateFamilyInput) {}
 */
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  transform(value: unknown): TOutput {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'The submitted data is not valid.',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      throw error;
    }
  }
}
