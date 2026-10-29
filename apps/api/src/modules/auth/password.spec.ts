import { hashPassword, verifyPassword } from './password.js';

describe('Mots de passe (Argon2id)', () => {
  it('hache en Argon2id et vérifie', async () => {
    const hash = await hashPassword('mot de passe fictif');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'mot de passe fictif')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'autre')).resolves.toBe(false);
  });

  it('refuse sans hash (compte inconnu ou non activé)', async () => {
    await expect(verifyPassword(null, 'quelconque')).resolves.toBe(false);
  });
});
