import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Counter {
  failures: number;
  windowStart: number;
  blockedUntil: number;
}

/** Échecs tolérés par couple (adresse IP, e-mail), puis par adresse IP seule, sur la fenêtre. */
export const LOGIN_LIMITS = { perAccount: 5, perIp: 20, windowMs: 15 * 60_000 } as const;

/**
 * Limitation des tentatives de connexion, en mémoire : adaptée à l'instance unique prévue
 * (pas de Redis, D12). Elle est réinitialisée au redémarrage de l'API.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly counters = new Map<string, Counter>();

  assertAllowed(ip: string, email: string): void {
    const time = Date.now();
    for (const key of this.keys(ip, email)) {
      const counter = this.counters.get(key);
      if (counter && counter.blockedUntil > time) {
        throw new HttpException(
          {
            code: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(ip: string, email: string): void {
    const time = Date.now();
    const [accountKey, ipKey] = this.keys(ip, email);
    this.increment(accountKey, LOGIN_LIMITS.perAccount, time);
    this.increment(ipKey, LOGIN_LIMITS.perIp, time);
    this.prune(time);
  }

  /** Connexion réussie : le compteur du couple est effacé (celui de l'adresse IP est conservé). */
  recordSuccess(ip: string, email: string): void {
    this.counters.delete(this.keys(ip, email)[0]);
  }

  private keys(ip: string, email: string): [account: string, ip: string] {
    return [`account:${ip}:${email}`, `ip:${ip}`];
  }

  private increment(key: string, limit: number, time: number): void {
    let counter = this.counters.get(key);
    if (!counter || time - counter.windowStart > LOGIN_LIMITS.windowMs) {
      counter = { failures: 0, windowStart: time, blockedUntil: 0 };
      this.counters.set(key, counter);
    }
    counter.failures += 1;
    if (counter.failures >= limit) counter.blockedUntil = time + LOGIN_LIMITS.windowMs;
  }

  /** Évite une croissance illimitée de la table en mémoire. */
  private prune(time: number): void {
    if (this.counters.size < 10_000) return;
    for (const [key, counter] of this.counters) {
      if (time - counter.windowStart > LOGIN_LIMITS.windowMs && counter.blockedUntil <= time) {
        this.counters.delete(key);
      }
    }
  }
}
