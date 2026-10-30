import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  type Authority,
  effectivePermissions,
  loginInputSchema,
  type Permission,
  PERMISSION_KEYS,
  type SessionUser,
} from '@tesla/shared';
import { parseInput } from '../../common/validation.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  activeDelegationWhere,
  activeMandateWhere,
  civilToday,
} from '../leadership/leadership-rules.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { verifyPassword } from './password.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

/** Fréquence maximale de mise à jour de `last_used_at` (évite une écriture par requête). */
const LAST_USED_REFRESH_MS = 5 * 60_000;

const userWithProfile = { scoutProfile: { select: { id: true } } } as const;

function toSessionUser(
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    scoutProfile: { id: string } | null;
  },
  authority: Authority,
): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: authority.role,
    scoutProfileId: user.scoutProfile?.id ?? null,
    leaderFunction: authority.leaderFunction,
    permissions: effectivePermissions(authority),
  };
}

const CURRENT_ROLES = new Set<string>(['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR']);

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
    const throttleKeys = this.limiter.loginKeys(context.ip, email);
    await this.limiter.assertAllowed(throttleKeys);

    const user = await this.prisma.user.findUnique({ where: { email }, include: userWithProfile });
    const passwordOk = await verifyPassword(user?.passwordHash ?? null, password);
    if (!user || !passwordOk || !user.isActive) {
      await this.limiter.recordFailure(throttleKeys);
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
    await this.limiter.recordSuccess(throttleKeys[0]!);

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
    return { token, expiresAt, user: toSessionUser(user, await this.resolveAuthority(user)) };
  }

  /** Session valide : non révoquée, non expirée, compte actif. Sinon `null`. */
  async authenticate(
    token: string,
  ): Promise<{ sessionId: string; user: SessionUser; authority: Authority } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: userWithProfile } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) {
      return null;
    }
    const authority = await this.resolveAuthority(session.user);
    if (
      !session.lastUsedAt ||
      now.getTime() - session.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
    ) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }
    return { sessionId: session.id, user: toSessionUser(session.user, authority), authority };
  }

  /** Utilisateur tel que renvoyé par `/auth/me` (après une modification de son propre compte). */
  async currentUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithProfile,
    });
    return toSessionUser(user, await this.resolveAuthority(user));
  }

  /**
   * Habilitations effectives à la date civile du jour : rôle d'accès, fonction du mandat en vigueur,
   * délégations actives (D94). Recalculées à chaque requête : un mandat échu ou une délégation
   * expirée cesse de produire ses effets sans tâche planifiée.
   */
  async resolveAuthority(user: { id: string; role: string }): Promise<Authority> {
    return resolveAuthority(this.prisma, user);
  }

  /**
   * Dernier jour où les habilitations actuelles restent acquises : fin du mandat en vigueur ou de
   * la plus proche délégation active (null : aucune échéance, ex. routier). Borne l'usage local
   * hors connexion (D112) ; l'API recalcule toujours les droits à chaque requête.
   */
  async authorityValidUntil(userId: string): Promise<string | null> {
    const today = civilToday();
    const [mandate, delegations] = await Promise.all([
      this.prisma.leadershipMandate.findFirst({
        where: { userId, ...activeMandateWhere(today) },
        select: { endsOn: true, endedEarlyOn: true },
      }),
      this.prisma.delegation.findMany({
        where: { delegateId: userId, ...activeDelegationWhere(today) },
        select: { endsOn: true },
      }),
    ]);
    const ends = [
      ...(mandate ? [mandate.endedEarlyOn ?? mandate.endsOn] : []),
      ...delegations.map((d) => d.endsOn),
    ].map((date) => date.toISOString().slice(0, 10));
    return ends.length > 0 ? ends.sort()[0]! : null;
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

/**
 * Habilitations effectives à la date civile du jour : rôle d'accès, fonction du mandat en vigueur,
 * délégations actives (D94). Partagé par la garde de session et les commandes serveur.
 */
export async function resolveAuthority(
  prisma: Pick<PrismaService, 'leadershipMandate' | 'delegation'>,
  user: { id: string; role: string },
): Promise<Authority> {
  // Rôle historique (impossible en base après migration, contrainte users_role_current_check) :
  // aucun droit plutôt qu'un droit présumé.
  if (!CURRENT_ROLES.has(user.role)) {
    return { role: 'ROUTIER', leaderFunction: null, delegated: [] };
  }
  const role = user.role as Authority['role'];
  if (role !== 'ENCADREMENT') return { role, leaderFunction: null, delegated: [] };
  const today = civilToday();
  const [mandate, delegations] = await Promise.all([
    prisma.leadershipMandate.findFirst({
      where: { userId: user.id, ...activeMandateWhere(today) },
      select: { function: true },
    }),
    prisma.delegation.findMany({
      where: { delegateId: user.id, ...activeDelegationWhere(today) },
      select: { permissions: true },
    }),
  ]);
  const known = new Set<string>(PERMISSION_KEYS);
  const delegated = [...new Set(delegations.flatMap((d) => d.permissions))].filter((p) =>
    known.has(p),
  ) as Permission[];
  return {
    role,
    leaderFunction: mandate?.function ?? null,
    delegated,
  };
}
