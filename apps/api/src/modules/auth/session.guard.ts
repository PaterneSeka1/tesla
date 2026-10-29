import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE_NAME } from '@tesla/shared';
import { type AuthenticatedRequest, IS_PUBLIC } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { readCookie } from './session-token.js';

/**
 * Garde globale : toute route exige une session valide, sauf `@Public()`.
 * Les permissions métier (rôle, périmètre) sont vérifiées ensuite par les services (`assertCan`).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    const session = token ? await this.auth.authenticate(token) : null;
    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Session absente ou expirée. Veuillez vous reconnecter.',
      });
    }
    request.actor = { userId: session.user.id, ...session.authority };
    request.sessionUser = session.user;
    return true;
  }
}
