import { formatAttemptCode } from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';

/**
 * Émet le code public d'une tentative (RM-007) dans la transaction de création.
 *
 * Compteur annuel incrémenté par un `INSERT … ON CONFLICT DO UPDATE … RETURNING` : PostgreSQL verrouille
 * la ligne de l'année jusqu'à la fin de la transaction, ce qui sérialise les émissions concurrentes sans
 * boucle de collision et sans dépendre du nombre de lignes. Si la transaction échoue, le numéro n'a jamais
 * été émis ; une tentative annulée conserve son code (elle n'est jamais supprimée), qui n'est donc jamais réutilisé.
 */
export async function issueAttemptCode(
  tx: Prisma.TransactionClient,
  issuedAt: Date,
): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO attempt_code_counters (year, last_value, updated_at)
    VALUES (${year}, 1, now())
    ON CONFLICT (year) DO UPDATE
      SET last_value = attempt_code_counters.last_value + 1, updated_at = now()
    RETURNING last_value`;
  const sequence = rows[0]?.last_value;
  if (sequence === undefined) throw new Error('Compteur de codes de tentative indisponible.');
  return formatAttemptCode(year, sequence);
}
