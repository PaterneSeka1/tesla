import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { loginInputSchema, type SessionUser } from '@tesla/shared';
import { parseInput } from '../../common/validation.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { verifyPassword } from './password.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

/** Fréquence maximale de mise à jour de `last_used_at` (évite une écriture par requête). */
const LAST_USED_REFRESH_MS = 5 * 60_000;

const userWithProfile = { scoutProfile: { select: { id: true } } } as const;

function toSessionUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SessionUser['role'];
  scoutProfile: { id: string } | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    scoutProfileId: user.scoutProfile?.id ?? null,
  };
}

/** Sessions serveur : jeton opaque dans un cookie httpOnly, hash SHA-256 en base, révocables. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: LoginRateLimiter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(
    input: unknown,
    context: { ip: string; userAgent?: string },
  ): Promise<{ token: string; expiresAt: Date; user: SessionUser }> {
    const { email, password } = parseInput(loginInputSchema, input);
    this.limiter.assertAllowed(context.ip, email);

    const user = await this.prisma.user.findUnique({ where: { email }, include: userWithProfile });
    const passwordOk = await verifyPassword(user?.passwordHash ?? null, password);
    if (!user || !passwordOk || !user.isActive) {
      this.limiter.recordFailure(context.ip, email);
      if (user) {
        await this.prisma.auditLog.create({
          data: { action: 'auth.login_failed', entityType: 'User', entityId: user.id },
        });
      }
      this.logger.warn('Échec de connexion');
      // Message unique : ne révèle ni l'existence du compte ni son état.
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Adresse e-mail ou mot de passe incorrect.',
      });
    }
    this.limiter.recordSuccess(context.ip, email);

    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.env.SESSION_TTL_HOURS * 3_600_000);
    await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(token),
          userAgent: context.userAgent?.slice(0, 500) ?? null,
          expiresAt,
          lastUsedAt: now,
        },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
      this.prisma.auditLog.create({
        data: { actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id },
      }),
    ]);
    return { token, expiresAt, user: toSessionUser(user) };
  }

  /** Session valide : non révoquée, non expirée, compte actif. Sinon `null`. */
  async authenticate(token: string): Promise<{ sessionId: string; user: SessionUser } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: userWithProfile } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) {
      return null;
    }
    if (
      !session.lastUsedAt ||
      now.getTime() - session.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
    ) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }
    return { sessionId: session.id, user: toSessionUser(session.user) };
  }

  /** Révoque la session (sans effet si elle est inconnue ou déjà révoquée). */
  async logout(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Révoque toutes les sessions d'un compte (désactivation, changement de mot de passe). */
  async revokeAll(userId: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
