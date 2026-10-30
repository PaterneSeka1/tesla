import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Fenêtre d'observation et durée de blocage une fois le seuil atteint. */
export const THROTTLE_WINDOW_SECONDS = 15 * 60;

/**
 * Seuils d'échecs par fenêtre :
 * - `account` : couple (adresse IP, e-mail) — devinette ciblée ;
 * - `email` : e-mail seul, toutes adresses IP — attaque distribuée sur un compte ;
 * - `ip` : adresse IP seule — balayage de comptes (seuil large : réseaux partagés) ;
 * - `token` : liens d'activation invalides par adresse IP ;
 * - `password` : mot de passe actuel erroné lors d'un changement, par compte.
 */
export const THROTTLE_LIMITS = {
  account: 5,
  email: 10,
  ip: 20,
  token: 20,
  password: 5,
} as const;

type Scope = keyof typeof THROTTLE_LIMITS;

interface ThrottleKey {
  scope: Scope;
  hash: string;
}

function throttleKey(scope: Scope, ...parts: string[]): ThrottleKey {
  // Empreinte seulement : ni adresse IP ni e-mail en clair dans la table.
  const hash = createHash('sha256')
    .update([scope, ...parts].join('\u0000'))
    .digest('hex');
  return { scope, hash };
}

const tooManyAttempts = () =>
  new HttpException(
    {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Trop de tentatives. Réessayez dans quelques minutes.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

/**
 * Limitation des tentatives d'authentification, persistée dans PostgreSQL (D120) : partagée par
 * toutes les instances de l'API et conservée au redémarrage, sans service supplémentaire (pas de
 * Redis). Chaque échec est compté par une seule instruction atomique (`INSERT … ON CONFLICT`).
 */
@Injectable()
export class LoginRateLimiter {
  constructor(private readonly prisma: PrismaService) {}

  loginKeys(ip: string, email: string): ThrottleKey[] {
    return [throttleKey('account', ip, email), throttleKey('email', email), throttleKey('ip', ip)];
  }

  tokenKeys(ip: string): ThrottleKey[] {
    return [throttleKey('token', ip)];
  }

  passwordKeys(userId: string): ThrottleKey[] {
    return [throttleKey('password', userId)];
  }

  /** 429 si l'une des portées est bloquée. */
  async assertAllowed(keys: readonly ThrottleKey[]): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ blocked: number }[]>`
      SELECT 1 AS blocked FROM auth_throttles
      WHERE key = ANY(${keys.map((key) => key.hash)}::text[]) AND blocked_until > now()
      LIMIT 1`;
    if (rows.length > 0) throw tooManyAttempts();
  }

  async recordFailure(keys: readonly ThrottleKey[]): Promise<void> {
    for (const { scope, hash } of keys) {
      const limit = THROTTLE_LIMITS[scope];
      await this.prisma.$executeRaw`
        INSERT INTO auth_throttles (key, failures, window_start, blocked_until, updated_at)
        VALUES (
          ${hash}, 1, now(),
          CASE WHEN 1 >= ${limit}::int
            THEN now() + make_interval(secs => ${THROTTLE_WINDOW_SECONDS}::double precision) END,
          now()
        )
        ON CONFLICT (key) DO UPDATE SET
          failures = CASE
            WHEN auth_throttles.window_start
              <= now() - make_interval(secs => ${THROTTLE_WINDOW_SECONDS}::double precision)
            THEN 1 ELSE auth_throttles.failures + 1 END,
          window_start = CASE
            WHEN auth_throttles.window_start
              <= now() - make_interval(secs => ${THROTTLE_WINDOW_SECONDS}::double precision)
            THEN now() ELSE auth_throttles.window_start END,
          blocked_until = CASE
            WHEN (CASE
              WHEN auth_throttles.window_start
                <= now() - make_interval(secs => ${THROTTLE_WINDOW_SECONDS}::double precision)
              THEN 1 ELSE auth_throttles.failures + 1 END) >= ${limit}::int
            THEN now() + make_interval(secs => ${THROTTLE_WINDOW_SECONDS}::double precision)
            ELSE auth_throttles.blocked_until END,
          updated_at = now()`;
    }
  }

  /**
   * Succès : efface le compteur ciblé (couple adresse IP/e-mail, ou changement de mot de passe).
   * Les compteurs par adresse IP et par e-mail seul sont conservés jusqu'à expiration.
   */
  async recordSuccess(key: ThrottleKey): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { key: key.hash } });
  }

  /** Purge des compteurs inactifs depuis plus d'un jour (tâche quotidienne). */
  async purge(): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM auth_throttles
      WHERE updated_at < now() - interval '1 day'
        AND (blocked_until IS NULL OR blocked_until < now())`;
  }
}
