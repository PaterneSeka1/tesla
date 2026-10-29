import { HttpException } from '@nestjs/common';
import { LOGIN_LIMITS, LoginRateLimiter } from './login-rate-limiter.js';

describe('LoginRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-28T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  const fail = (limiter: LoginRateLimiter, times: number, ip = '10.0.0.1', email = 'a@x.test') => {
    for (let i = 0; i < times; i += 1) limiter.recordFailure(ip, email);
  };

  it('bloque un couple IP/e-mail après le nombre d’échecs autorisé (429)', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, LOGIN_LIMITS.perAccount - 1);
    expect(() => limiter.assertAllowed('10.0.0.1', 'a@x.test')).not.toThrow();
    fail(limiter, 1);
    try {
      limiter.assertAllowed('10.0.0.1', 'a@x.test');
      expect.unreachable();
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    // Un autre compte depuis la même adresse reste autorisé tant que le seuil IP n'est pas atteint.
    expect(() => limiter.assertAllowed('10.0.0.1', 'b@x.test')).not.toThrow();
  });

  it('débloque après la fenêtre', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, LOGIN_LIMITS.perAccount);
    vi.advanceTimersByTime(LOGIN_LIMITS.windowMs + 1);
    expect(() => limiter.assertAllowed('10.0.0.1', 'a@x.test')).not.toThrow();
  });

  it('bloque une adresse IP qui essaie de nombreux comptes', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < LOGIN_LIMITS.perIp; i += 1)
      limiter.recordFailure('10.0.0.2', `u${i}@x.test`);
    expect(() => limiter.assertAllowed('10.0.0.2', 'nouveau@x.test')).toThrow(HttpException);
  });

  it('une connexion réussie efface le compteur du couple', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, LOGIN_LIMITS.perAccount - 1);
    limiter.recordSuccess('10.0.0.1', 'a@x.test');
    fail(limiter, LOGIN_LIMITS.perAccount - 1);
    expect(() => limiter.assertAllowed('10.0.0.1', 'a@x.test')).not.toThrow();
  });
});
