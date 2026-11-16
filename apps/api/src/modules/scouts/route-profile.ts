import { UnprocessableEntityException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client.js';

// Apprenants adultes (D185) : aucune donnée propre à la Route (équipe, présence, étude, rattrapage,
// exception, parcours antérieur, compétence, dérogation, observation). Le trigger SQL
// `route_only_scout_profile` en est le garde-fou ; ce contrôle donne une erreur explicite.

export function adultNotInRoute(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'ADULT_NOT_IN_ROUTE',
    message:
      'Cette action concerne la progression de la Route : elle ne s’applique pas à un apprenant adulte.',
  });
}

/** Refuse (422) une fiche adulte ; une fiche absente est laissée au contrôle de l'appelant. */
export async function assertRouteProfile(
  db: Prisma.TransactionClient,
  scoutProfileId: string,
): Promise<void> {
  const row = await db.scoutProfile.findUnique({
    where: { id: scoutProfileId },
    select: { kind: true },
  });
  if (row?.kind === 'ADULTE') throw adultNotInRoute();
}
