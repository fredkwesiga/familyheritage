import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode, type ApiErrorBody } from '@fh/shared';

/**
 * One error shape for the entire API (see apiErrorSchema in @fh/shared).
 *
 * Two rules encoded here:
 *  1. Unexpected errors never leak their message to the client. A stack trace
 *     from Prisma can contain a connection string or a row of family data.
 *  2. Every error carries a requestId that also appears in the server log, so a
 *     user report ("I saw error abc123") is traceable without guesswork.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = request.id;

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'An unexpected error occurred.';
    let code: string = ErrorCode.INTERNAL;
    let issues: ApiErrorBody['issues'];

    if (isHttp) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        message = typeof body.message === 'string' ? body.message : exception.message;
        if (typeof body.code === 'string') code = body.code;
        if (Array.isArray(body.issues)) issues = body.issues as ApiErrorBody['issues'];
      }
      if (code === ErrorCode.INTERNAL) code = statusToCode(status);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} -> ${status}: ${message}`);
    }

    const body: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      ...(issues ? { issues } : {}),
      requestId,
      timestamp: new Date().toISOString(),
    };

    void reply.status(status).send(body);
  }
}

function statusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_FAILED;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ErrorCode.RATE_LIMITED;
    default:
      return ErrorCode.INTERNAL;
  }
}
