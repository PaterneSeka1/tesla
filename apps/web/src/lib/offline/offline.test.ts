import { describe, expect, it } from 'vitest';
import { offlineSyncInputSchema } from '@tesla/shared';
import { imageSources, sha256 } from './downloads';
import { retryDelay } from './attempts';

describe('contrats hors ligne et résilience', () => {
  it('rejette un score navigateur et les identifiants non valides', () => {
    const payload = {
      operationId: crypto.randomUUID(),
      authorization: crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      deviceSubmittedAt: new Date().toISOString(),
      answers: [{ questionId: crypto.randomUUID() }],
    };
    expect(offlineSyncInputSchema.safeParse(payload).success).toBe(true);
    expect(offlineSyncInputSchema.safeParse({ ...payload, score: 100 }).success).toBe(false);
    expect(offlineSyncInputSchema.safeParse({ ...payload, authorization: 'faux' }).success).toBe(
      false,
    );
  });
  it('déduplique les images imbriquées sans interpréter de HTML', () => {
    const image = { type: 'image', attrs: { src: 'https://example.test/image.png' } };
    expect(
      imageSources({
        type: 'doc',
        content: [
          { type: 'blockquote', content: [image] },
          image,
          { type: 'paragraph', content: [{ type: 'text', text: '<img src="secret">' }] },
        ],
      }),
    ).toEqual(['https://example.test/image.png']);
  });
  it('vérifie une empreinte SHA-256 connue et détecte une modification', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await sha256('abd')).not.toBe(await sha256('abc'));
  });
  it('borne la temporisation progressive à trente minutes', () => {
    expect(retryDelay(0)).toBe(5000);
    expect(retryDelay(1)).toBe(10000);
    expect(retryDelay(20)).toBe(30 * 60_000);
  });
});
