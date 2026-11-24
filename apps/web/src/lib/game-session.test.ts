import { beforeEach, describe, expect, it, vi } from 'vitest';

// Coffre de l'appareil simulé : ouvert pour un seul compte à la fois.
const vault = vi.hoisted(() => ({
  owner: null as string | null,
  records: new Map<string, unknown>(),
}));
vi.mock('./offline/vault', () => ({
  ensureVaultRestored: async () => {},
  ownerId: () => vault.owner,
  readRecord: async (id: string) =>
    vault.records.has(`${vault.owner}:${id}`)
      ? { value: vault.records.get(`${vault.owner}:${id}`), revision: 1 }
      : null,
  putRecord: async (id: string, value: unknown) => {
    vault.records.set(`${vault.owner}:${id}`, structuredClone(value));
    return true;
  },
  deleteRecord: async (id: string) => {
    vault.records.delete(`${vault.owner}:${id}`);
  },
}));

const {
  clearGameSession,
  forgetOtherAccounts,
  loadGameSession,
  purgeLegacyGameStorage,
  saveGameSession,
} = await import('./game-session');

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

const session = (data: unknown, savedAt = new Date().toISOString()) => ({
  id: 'partie-1',
  savedAt,
  data,
});

describe('sauvegarde des parties (D201)', () => {
  beforeEach(() => {
    vault.owner = null;
    vault.records.clear();
    vi.stubGlobal('window', { sessionStorage: memoryStorage(), localStorage: memoryStorage() });
  });

  it('sans coffre : onglet seulement, isolé par compte', async () => {
    expect(await saveGameSession('compte-a', 'express:*', session({ index: 2 }))).toBe(false);
    expect((await loadGameSession('compte-a', 'express:*'))?.data).toEqual({ index: 2 });
    expect(await loadGameSession('compte-b', 'express:*')).toBeNull();
    // Rien dans le stockage durable partagé du navigateur.
    expect(window.localStorage.length).toBe(0);
  });

  it('changement de compte dans l’onglet : les parties de l’autre compte sont effacées', async () => {
    await saveGameSession('compte-a', 'express:*', session({ index: 2 }));
    forgetOtherAccounts('compte-b');
    expect(await loadGameSession('compte-a', 'express:*')).toBeNull();
  });

  it('avec coffre ouvert pour ce compte : chiffré, reprise après fermeture', async () => {
    vault.owner = 'compte-a';
    expect(await saveGameSession('compte-a', 'ascension:*', session({ level: 4 }))).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
    expect((await loadGameSession('compte-a', 'ascension:*'))?.data).toEqual({ level: 4 });
    // Le coffre d'un autre compte ne donne jamais accès à cette partie.
    vault.owner = 'compte-b';
    expect(await loadGameSession('compte-b', 'ascension:*')).toBeNull();
    vault.owner = 'compte-a';
    await clearGameSession('compte-a', 'ascension:*');
    expect(await loadGameSession('compte-a', 'ascension:*')).toBeNull();
  });

  it('une partie trop ancienne n’est pas reprise ; les anciennes clés partagées sont purgées', async () => {
    window.sessionStorage.setItem(
      'tesla.game:compte-a:express:*',
      JSON.stringify(session({ index: 1 }, '2020-01-01T00:00:00Z')),
    );
    expect(await loadGameSession('compte-a', 'express:*')).toBeNull();
    window.localStorage.setItem('tesla.games.ascension', '{"state":{}}');
    window.localStorage.setItem('tesla.games.position', '{}');
    purgeLegacyGameStorage();
    expect(window.localStorage.length).toBe(0);
  });
});
