import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  emailOnlyInputSchema,
  loginInputSchema,
  passwordResetConfirmSchema,
  registerInputSchema,
  tokenInputSchema,
  type AcceptedResponse,
  type AuthResponse,
  type EmailOnlyInput,
  type LoginInput,
  type OkResponse,
  type PasswordResetConfirmInput,
  type RegisterInput,
  type SessionUser,
  type TokenInput,
} from '@fh/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { Env } from '../config/env.schema';
import { AuthService, type RequestContext } from './auth.service';
import { SESSION_COOKIE, type AuthenticatedUser } from './auth.types';
import { sessionCookieOptions } from './cookie.util';
import { SessionService } from './session.service';

/** Five attempts per minute on anything that guesses a credential. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
/** Three per minute on anything that sends an email, to stop mailbox flooding. */
const EMAIL_SENDING = { default: { limit: 3, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  async register(
    @Body(new ZodValidationPipe(registerInputSchema)) body: RegisterInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const { user, session } = await this.auth.register(body, this.contextFrom(request));
    this.setSessionCookie(reply, session.token, session.expiresAt);
    return { user };
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body(new ZodValidationPipe(loginInputSchema)) body: LoginInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const { user, session } = await this.auth.login(body, this.contextFrom(request));
    this.setSessionCookie(reply, session.token, session.expiresAt);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the current session' })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<OkResponse> {
    if (request.authSessionId) {
      await this.sessions.revoke(request.authSessionId);
    }
    this.clearSessionCookie(reply);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End every session on every device' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<OkResponse> {
    await this.sessions.revokeAllForUser(user.id);
    this.clearSessionCookie(reply);
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user and the families they belong to' })
  me(@CurrentUser() user: AuthenticatedUser): { user: SessionUser } {
    return { user: this.auth.toSessionUser(user) };
  }

  @Public()
  @Throttle(EMAIL_SENDING)
  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a one-time sign-in link',
    description:
      'Always returns 202, whether or not the address belongs to an account. Responding ' +
      'differently would turn this endpoint into an account-existence oracle.',
  })
  async requestMagicLink(
    @Body(new ZodValidationPipe(emailOnlyInputSchema)) body: EmailOnlyInput,
  ): Promise<AcceptedResponse> {
    await this.auth.requestMagicLink(body.email);
    return { accepted: true };
  }

  @Public()
  @Throttle(STRICT)
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a sign-in link token for a session' })
  async verifyMagicLink(
    @Body(new ZodValidationPipe(tokenInputSchema)) body: TokenInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const { user, session } = await this.auth.verifyMagicLink(
      body.token,
      this.contextFrom(request),
    );
    this.setSessionCookie(reply, session.token, session.expiresAt);
    return { user };
  }

  @Public()
  @Throttle(EMAIL_SENDING)
  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Email a password reset link' })
  async requestPasswordReset(
    @Body(new ZodValidationPipe(emailOnlyInputSchema)) body: EmailOnlyInput,
  ): Promise<AcceptedResponse> {
    await this.auth.requestPasswordReset(body.email);
    return { accepted: true };
  }

  @Public()
  @Throttle(STRICT)
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password using a reset token',
    description: 'Revokes every existing session for that user on success.',
  })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema)) body: PasswordResetConfirmInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<OkResponse> {
    await this.auth.confirmPasswordReset(body.token, body.password);
    this.clearSessionCookie(reply);
    return { ok: true };
  }

  @Public()
  @Throttle(STRICT)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address' })
  async verifyEmail(
    @Body(new ZodValidationPipe(tokenInputSchema)) body: TokenInput,
  ): Promise<OkResponse> {
    await this.auth.verifyEmail(body.token);
    return { ok: true };
  }

  // ------------------------------------------------------------------ helpers

  private get isProduction(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    void reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(this.isProduction, expiresAt));
  }

  private clearSessionCookie(reply: FastifyReply): void {
    void reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.isProduction));
  }

  private contextFrom(request: FastifyRequest): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}