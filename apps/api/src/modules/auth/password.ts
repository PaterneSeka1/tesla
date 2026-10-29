import argon2 from 'argon2';

/**
 * Paramètres Argon2id (recommandation OWASP : m = 19 Mio, t = 2, p = 1), adaptés à un VPS modeste.
 * Les paramètres sont encodés dans chaque hash : ils peuvent évoluer sans invalider les anciens.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Vérifie un mot de passe. Sans hash (compte inconnu ou non activé), une vérification factice est
 * effectuée quand même : la durée de réponse ne révèle pas l'existence du compte.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (hash === null) {
    dummyHash ??= hashPassword('mot-de-passe-factice-de-comparaison');
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return argon2.verify(hash, password).catch(() => false);
}
