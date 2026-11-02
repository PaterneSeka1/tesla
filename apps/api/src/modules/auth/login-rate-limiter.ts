import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Politique de limitation, centralisée ici (D120, D165) : ajuster une valeur ne touche aucun code
 * métier. `limit` : nombre d'événements tolérés dans la fenêtre `windowSeconds` ; au-delà, la clé
 * est bloquée `windowSeconds` secondes, jamais définitivement. Les événements comptés sont :
 * - les **échecs** pour la connexion et les secrets (un succès ne pénalise personne, et plusieurs
 *   routiers derrière la même adresse IP ne se bloquent pas en se connectant normalement) ;
 * - les **requêtes** pour les opérations coûteuses ou à effet externe (récupération, lots, PDF).
 *
 * Portées :
 * - `account` : couple (adresse IP, e-mail) — devinette ciblée ;
 * - `email` : e-mail seul, toutes adresses IP — attaque répartie sur un compte ;
 * - `ip` : adresse IP seule — balayage de comptes (seuil large : réseaux partagés) ;
 * - `token` : liens ou codes d'activation et de récupération invalides, par adresse IP ;
 * - `codeEmail` : codes erronés pour un e-mail (en plus des 5 essais par invitation, D162) ;
 * - `password` : mot de passe actuel erroné lors d'un changement, par compte ;
 * - `resetAccount` / `resetIp` : demandes « mot de passe oublié » par e-mail et par adresse IP ;
 * - `reissue` : nouveaux liens émis pour un même compte (renvoi d'invitation) ;
 * - `batch` : préparations collectives par utilisateur ; `pdf` : documents groupés par utilisateur.
 */
export const RATE_LIMIT_POLICY = {
  account: { limit: 5, windowSeconds: 15 * 60 },
  email: { limit: 10, windowSeconds: 15 * 60 },
  ip: { limit: 20, windowSeconds: 15 * 60 },
  token: { limit: 20, windowSeconds: 15 * 60 },
  codeEmail: { limit: 10, windowSeconds: 60 * 60 },
  password: { limit: 5, windowSeconds: 15 * 60 },
  resetAccount: { limit: 3, windowSeconds: 60 * 60 },
  resetIp: { limit: 10, windowSeconds: 60 * 60 },
  reissue: { limit: 3, windowSeconds: 60 * 60 },
  batch: { limit: 20, windowSeconds: 15 * 60 },
  pdf: { limit: 120, windowSeconds: 15 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

/** Essais de code tolérés par invitation ou demande de récupération avant révocation (D162). */
export const CODE_MAX_FAILURES = 5;

/** Compatibilité : seuils seuls, par portée. */
export const THROTTLE_LIMITS = Object.fromEntries(
  Object.entries(RATE_LIMIT_POLICY).map(([scope, { limit }]) => [scope, limit]),
) as { [S in Scope]: (typeof RATE_LIMIT_POLICY)[S]['limit'] };

/** Fenêtre de la connexion (historique, D120). */
export const THROTTLE_WINDOW_SECONDS = RATE_LIMIT_POLICY.account.windowSeconds;

export type Scope = keyof typeof RATE_LIMIT_POLICY;

export interface ThrottleKey {
  scope: Scope;
  hash: string;
}

export function throttleKey(scope: Scope, ...parts: string[]): ThrottleKey {
  // Empreinte seulement : ni adresse IP, ni e-mail, ni identifiant en clair dans la table.
  const hash = createHash('sha256')
    .update([scope, ...parts].join('\u0000'))
    .digest('hex');
  return { scope, hash };
}

/**
 * 429 avec `Retry-After` (posé par `AllExceptionsFilter`). Message neutre : ne dit jamais si un
 * compte existe.
 */
export class TooManyAttemptsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute${retryAfterSeconds > 60 ? 's' : ''}.`,
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Limitation persistée dans PostgreSQL (D120) : partagée par toutes les instances de l'API et
 * conservée au redémarrage, sans service supplémentaire (pas de Redis). Chaque événement est compté
 * par une seule instruction atomique (`INSERT … ON CONFLICT … RETURNING`) : des requêtes
 * simultanées ne peuvent pas dépasser le seuil ensemble.
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

  /** Code saisi avec un e-mail : adresse IP et e-mail (empêche le balayage depuis plusieurs IP). */
  codeKeys(ip: string, email: string): ThrottleKey[] {
    return [throttleKey('token', ip), throttleKey('codeEmail', email)];
  }

  passwordKeys(userId: string): ThrottleKey[] {
    return [throttleKey('password', userId)];
  }

  resetRequestKeys(ip: string, email: string): ThrottleKey[] {
    return [throttleKey('resetAccount', email), throttleKey('resetIp', ip)];
  }

  userKeys(scope: 'batch' | 'pdf' | 'reissue', userId: string): ThrottleKey[] {
    return [throttleKey(scope, userId)];
  }

  /** 429 si l'une des portées est bloquée ; `Retry-After` = échéance la plus lointaine. */
  async assertAllowed(keys: readonly ThrottleKey[]): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ retry: number }[]>`
      SELECT ceil(extract(epoch FROM max(blocked_until) - now()))::int AS retry
      FROM auth_throttles
      WHERE key = ANY(${keys.map((key) => key.hash)}::text[]) AND blocked_until > now()`;
    const retry = rows[0]?.retry;
    if (retry !== undefined && retry !== null) throw new TooManyAttemptsException(retry);
  }

  /** Compte un échec (connexion, secret invalide) ; bloque la clé au seuil. */
  async recordFailure(keys: readonly ThrottleKey[]): Promise<void> {
    for (const key of keys) await this.increment(key);
  }

  /**
   * Compte une requête et la refuse si elle dépasse le seuil d'une portée (opérations coûteuses ou
   * à effet externe). Atomique : le compteur retourné inclut cette requête.
   */
  async consume(keys: readonly ThrottleKey[]): Promise<void> {
    await this.assertAllowed(keys);
    let retry = 0;
    for (const key of keys) {
      const { count, retryAfter } = await this.increment(key);
      if (count > RATE_LIMIT_POLICY[key.scope].limit) retry = Math.max(retry, retryAfter);
    }
    if (retry > 0) throw new TooManyAttemptsException(retry);
  }

  private async increment(key: ThrottleKey): Promise<{ count: number; retryAfter: number }> {
    const { limit, windowSeconds } = RATE_LIMIT_POLICY[key.scope];
    const rows = await this.prisma.$queryRaw<{ failures: number; retry: number | null }[]>`
      INSERT INTO auth_throttles (key, failures, window_start, blocked_until, updated_at)
      VALUES (
        ${key.hash}, 1, now(),
        CASE WHEN 1 >= ${limit}::int
          THEN now() + make_interval(secs => ${windowSeconds}::double precision) END,
        now()
      )
      ON CONFLICT (key) DO UPDATE SET
        failures = CASE
          WHEN auth_throttles.window_start
            <= now() - make_interval(secs => ${windowSeconds}::double precision)
          THEN 1 ELSE auth_throttles.failures + 1 END,
        window_start = CASE
          WHEN auth_throttles.window_start
            <= now() - make_interval(secs => ${windowSeconds}::double precision)
          THEN now() ELSE auth_throttles.window_start END,
        blocked_until = CASE
          WHEN (CASE
            WHEN auth_throttles.window_start
              <= now() - make_interval(secs => ${windowSeconds}::double precision)
            THEN 1 ELSE auth_throttles.failures + 1 END) >= ${limit}::int
          THEN now() + make_interval(secs => ${windowSeconds}::double precision)
          ELSE auth_throttles.blocked_until END,
        updated_at = now()
      RETURNING failures,
        ceil(extract(epoch FROM blocked_until - now()))::int AS retry`;
    const row = rows[0]!;
    return { count: row.failures, retryAfter: row.retry ?? windowSeconds };
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
