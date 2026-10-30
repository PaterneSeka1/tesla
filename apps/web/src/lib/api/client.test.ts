import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthResponseSchema } from '@tesla/shared';
import { z } from 'zod';
import { ApiError, apiFetch, toQueryString, withStrictReads } from './client';

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

  it('ajoute l’en-tête anti-CSRF aux écritures uniquement', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    await apiFetch('/auth/logout', z.null(), { method: 'POST' });
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.headers).toMatchObject({ 'x-tesla-csrf': '1' });
  });

  it('construit une chaîne de requête sans valeurs vides', () => {
    expect(toQueryString({ search: 'kouassi', teamId: '', page: 2, stageId: undefined })).toBe(
      '?search=kouassi&page=2',
    );
    expect(toQueryString({})).toBe('');
  });
});

describe('lectures strictes (préparation de l’appareil)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const schema = z.object({ items: z.array(z.string()) });

  it('une copie locale non enregistrée est une erreur, jamais un succès silencieux', async () => {
    mockFetch(() => jsonResponse({ items: ['a'] }));
    // Hors navigateur, aucun coffre n'est ouvert : la copie ne peut pas être enregistrée.
    await expect(apiFetch('/teams', schema)).resolves.toEqual({ items: ['a'] });
    await expect(withStrictReads(() => apiFetch('/teams', schema))).rejects.toThrow(
      /Copie locale impossible/,
    );
  });

  it('une coupure réseau n’est jamais compensée par une ancienne copie', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(withStrictReads(() => apiFetch('/teams', schema))).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});
