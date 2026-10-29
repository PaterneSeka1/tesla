import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { SessionGuard } from './session.guard.js';

/** Authentification : connexion, sessions httpOnly, déconnexion, garde globale. */
@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimiter, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService],
})
export class AuthModule {}
