import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, PasswordService, SessionService],
  // SessionService is exported because the global AuthGuard depends on it.
  exports: [SessionService, AuthService],
})
export class AuthModule {}