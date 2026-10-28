import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthResponseSchema } from '@tesla/shared';
import { ApiError, apiFetch } from './client';

function mockFetch(implementation: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(implementation));
}

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renvoie les données validées', async () => {
    const health = {
      status: 'ok',
      version: '0.1.0',
      uptimeSeconds: 3,
      timestamp: '2026-10-28T10:00:00.000Z',
      database: 'up',
    };
    mockFetch(() => jsonResponse(health));
    await expect(apiFetch('/health', healthResponseSchema)).resolves.toEqual(health);
    expect(fetch).toHaveBeenCalledWith('http://api.test/api/v1/health', expect.anything());
  });

  it("transmet le code et le message d'une erreur API", async () => {
    mockFetch(() =>
      jsonResponse(
        {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Ressource introuvable.',
          path: '/api/v1/x',
          timestamp: '2026-10-28T10:00:00.000Z',
        },
        404,
      ),
    );
    await expect(apiFetch('/x', healthResponseSchema)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Ressource introuvable.',
    });
  });

  it('signale une erreur réseau', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(apiFetch('/health', healthResponseSchema)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejette une réponse non conforme au contrat', async () => {
    mockFetch(() => jsonResponse({ status: 'inconnu' }));
    await expect(apiFetch('/health', healthResponseSchema)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
