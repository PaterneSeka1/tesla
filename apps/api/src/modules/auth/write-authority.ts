import { ForbiddenException } from '@nestjs/common';
import { type Permission } from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { resolveAuthority } from './auth.service.js';

/**
 * Revérifie une habilitation **au moment de l'écriture**, dans la transaction appelante, d'après le
 * compte et la désignation en vigueur à cet instant (D173). Protège les écritures réservées au
 * responsable plein contre un remplacement concurrent : la désignation (`LeadershipService`) prend le
 * verrou consultatif exclusif `leadership_assignments`, cette fonction le verrou partagé. Soit
 * l'écriture se termine avant le remplacement, soit elle attend celui-ci puis relit la fonction et
 * échoue : une modification commencée avant une révocation n'est jamais enregistrée après elle.
 * La session, le cookie et le navigateur ne sont jamais crus : seule la base fait foi.
 */
export async function assertCanAtWrite(
  tx: Prisma.TransactionClient,
  actor: Actor,
  permission: Permission,
): Promise<void> {
  assertCan(actor, permission);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('leadership_assignments'))`;
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    });
  }
  const authority = await resolveAuthority(tx, user);
  assertCan({ ...authority, userId: user.id }, permission);
}
