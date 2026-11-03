import { getRewrittenUrl, isRewrite } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from './api-proxy';

const secret = 'a'.repeat(64);
const config = { origin: 'https://api.tesla.test', secret };
const overridden = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://tesla.vercel.test${path}`, { headers });
}

describe('relais même origine de l’API', () => {
  it('réécrit /api/v1 vers l’API avec chemin et paramètres', () => {
    const response = proxyApiRequest(
      request('/api/v1/paper-attempts/NT-2026-000001/pdf?document=sheet'),
      config,
    );
    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe(
      'https://api.tesla.test/api/v1/paper-attempts/NT-2026-000001/pdf?document=sheet',
    );
  });

  it('transmet cookie, Origin et en-tête CSRF, ajoute le secret et l’adresse établie par Vercel', () => {
    const response = proxyApiRequest(
      request('/api/v1/auth/logout', {
        cookie: 'tesla_session=jeton',
        origin: 'https://tesla.vercel.test',
        'x-tesla-csrf': '1',
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      }),
      config,
    );
    expect(overridden(response, 'cookie')).toBe('tesla_session=jeton');
    expect(overridden(response, 'origin')).toBe('https://tesla.vercel.test');
    expect(overridden(response, 'x-tesla-csrf')).toBe('1');
    expect(overridden(response, 'x-tesla-proxy-secret')).toBe(secret);
    expect(overridden(response, 'x-tesla-client-ip')).toBe('203.0.113.7');
    // Host du web jamais transmis : Nginx doit choisir le site de l'API.
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).not.toContain('host');
  });

  it('ignore une adresse client fournie par le navigateur ou malformée', () => {
    const response = proxyApiRequest(
      request('/api/v1/auth/me', {
        'x-tesla-client-ip': '198.51.100.1',
        'x-forwarded-for': 'pas une ip',
      }),
      config,
    );
    expect(overridden(response, 'x-tesla-client-ip')).toBeNull();
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).not.toContain(
      'x-tesla-client-ip',
    );
  });

  it.each([
    [{ origin: undefined, secret }],
    [{ origin: 'http://api.tesla.test', secret }],
    [{ origin: 'https://api.tesla.test/api', secret }],
    [{ origin: 'https://api.tesla.test', secret: undefined }],
    [{ origin: 'https://api.tesla.test', secret: 'court' }],
  ])('refuse une configuration incomplète ou non sûre (503) : %o', async (bad) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = proxyApiRequest(request('/api/v1/auth/me'), bad);
    expect(isRewrite(response)).toBe(false);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      path: '/api/v1/auth/me',
    });
    error.mockRestore();
  });

  it('accepte http sur la boucle locale (essais)', () => {
    const response = proxyApiRequest(request('/api/v1/health'), {
      origin: 'http://127.0.0.1:4000',
      secret,
    });
    expect(getRewrittenUrl(response)).toBe('http://127.0.0.1:4000/api/v1/health');
  });
});
