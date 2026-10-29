/**
 * Référentiel d'âge initial (D96) : uniquement les deux règles fournies par le responsable
 * (mission de refonte du 2026-10-29). Aucune autre période d'étape, aucun délai de rattrapage,
 * aucun seuil d'alerte : ces valeurs restent nulles tant qu'elles ne sont pas validées.
 * Idempotent : un référentiel existant (même version) n'est jamais modifié (il est d'ailleurs figé).
 */
import { type PrismaClient } from '../../src/generated/prisma/client.js';

export const INITIAL_AGE_RULE_SET = {
  version: '2026.1',
  effectiveFrom: '2026-10-29',
  sourceReference:
    'Règles métier fournies par le responsable (mission de refonte du 2026-10-29) ; à rapprocher du manuel SAPF-Route, absent du dépôt.',
  notes:
    'Seules deux règles sont confirmées : noviciat d’un mois calendaire à compter du 18e anniversaire ; sortie de la branche le jour du 21e anniversaire. Âges des autres étapes, délai de rattrapage et seuil d’alerte : à valider (docs/DECISIONS.md).',
  branchExitAgeYears: 21,
  noviciate: { startYears: 18, startMonths: 0, endYears: 18, endMonths: 1 },
} as const;

export async function seedInitialAgeRuleSet(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.ageRuleSet.findUnique({
    where: { version: INITIAL_AGE_RULE_SET.version },
  });
  if (existing) {
    console.log(`Seed : référentiel d’âge ${existing.version} déjà présent (inchangé).`);
    return;
  }
  const noviciat = await prisma.progressionStage.findUniqueOrThrow({ where: { code: 'NOVICIAT' } });
  const rules = INITIAL_AGE_RULE_SET;
  await prisma.$transaction(async (tx) => {
    // Créé en brouillon avec ses règles, puis mis en vigueur (il devient alors immuable).
    const created = await tx.ageRuleSet.create({
      data: {
        version: rules.version,
        sourceReference: rules.sourceReference,
        notes: rules.notes,
        branchExitAgeYears: rules.branchExitAgeYears,
        stages: {
          create: {
            stageId: noviciat.id,
            ...rules.noviciate,
            sourceReference:
              'Règle fournie par le responsable : noviciat d’un mois calendaire à compter du 18e anniversaire.',
          },
        },
      },
    });
    await tx.ageRuleSet.update({
      where: { id: created.id },
      data: {
        status: 'EN_VIGUEUR',
        effectiveFrom: new Date(`${rules.effectiveFrom}T00:00:00Z`),
        activatedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'ageRules.seeded',
        entityType: 'AgeRuleSet',
        entityId: created.id,
        metadata: { version: rules.version, effectiveFrom: rules.effectiveFrom },
      },
    });
  });
  console.log(`Seed : référentiel d’âge ${rules.version} créé et mis en vigueur.`);
}
