import { generateSessionToken, hashSessionToken, readCookie } from './session-token.js';

describe('Jetons et cookies de session', () => {
  it('génère des jetons aléatoires de 256 bits et un hash déterministe', () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(generateSessionToken()).not.toBe(a);
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toContain(a);
  });

  it('lit un cookie parmi plusieurs et ignore les valeurs mal formées', () => {
    expect(readCookie('a=1; tesla_session=abc; b=2', 'tesla_session')).toBe('abc');
    expect(readCookie('tesla_session_x=1', 'tesla_session')).toBeUndefined();
    expect(readCookie(undefined, 'tesla_session')).toBeUndefined();
    expect(readCookie('tesla_session=%E0%A4%A', 'tesla_session')).toBeUndefined();
  });
});
