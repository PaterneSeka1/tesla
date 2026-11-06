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

/**
 * Référentiel `2026.2` (D176) : chronologie par l'âge adoptée par Nikola Tesla Académie, fournie par
 * le responsable (mission « progression automatique » du 2026-11-06). Adaptation propre à Tesla, qui
 * tient compte des périodes d'inactivité de l'année scoute : ce ne sont **pas** les durées du manuel
 * SAPF-Route (noviciat 1 mois, apprentissage 6 mois, compagnonnage 10 mois, départ une année scoute).
 * Délai de rattrapage : 21 jours par étape à rattraper (« environ deux à trois semaines », D177) ;
 * seuil d'alerte : non validé, laissé nul. Nouvelle version : `2026.1`
 * reste en vigueur pour les dates antérieures et n'est jamais modifiée.
 */
export const AGE_RULE_SET_2026_2 = {
  version: '2026.2',
  effectiveFrom: '2026-11-06',
  sourceReference:
    'Chronologie par l’âge adoptée par Nikola Tesla Académie (mission du responsable du 2026-11-06), adaptation propre à la communauté ; distincte des durées pédagogiques du manuel SAPF-Route.',
  notes:
    'Noviciat : du 18e anniversaire à 18 ans + 1 mois ; Apprentissage : jusqu’à la veille du 19e anniversaire ; Compagnonnage : du 19e au 20e anniversaire ; Préparation au Départ routier : du 20e au 21e anniversaire ; sortie de la branche le jour du 21e anniversaire. Rattrapages : 21 jours par étape, les étapes s’enchaînant dans l’ordre du parcours (D177). Seuil d’alerte : à valider.',
  branchExitAgeYears: 21,
  catchUpDelayDays: 21,
  stages: [
    { code: 'NOVICIAT', startYears: 18, startMonths: 0, endYears: 18, endMonths: 1 },
    { code: 'APPRENTISSAGE', startYears: 18, startMonths: 1, endYears: 19, endMonths: 0 },
    { code: 'COMPAGNONNAGE', startYears: 19, startMonths: 0, endYears: 20, endMonths: 0 },
    { code: 'DEPART_ROUTIER', startYears: 20, startMonths: 0, endYears: 21, endMonths: 0 },
  ],
} as const;

/** Idempotent : une version existante n'est jamais modifiée (elle est figée une fois en vigueur). */
export async function seedAgeRuleSet2026_2(prisma: PrismaClient): Promise<void> {
  const rules = AGE_RULE_SET_2026_2;
  const existing = await prisma.ageRuleSet.findUnique({ where: { version: rules.version } });
  if (existing) {
    console.log(`Seed : référentiel d’âge ${existing.version} déjà présent (inchangé).`);
    return;
  }
  const stages = await prisma.progressionStage.findMany({
    where: { code: { in: rules.stages.map((rule) => rule.code) } },
  });
  const byCode = new Map(stages.map((stage) => [stage.code, stage.id]));
  await prisma.$transaction(async (tx) => {
    const created = await tx.ageRuleSet.create({
      data: {
        version: rules.version,
        sourceReference: rules.sourceReference,
        notes: rules.notes,
        branchExitAgeYears: rules.branchExitAgeYears,
        catchUpDelayDays: rules.catchUpDelayDays,
        stages: {
          create: rules.stages.map(({ code, ...period }) => ({
            stageId: byCode.get(code)!,
            ...period,
            sourceReference: 'Chronologie Tesla validée par le responsable (2026-11-06).',
          })),
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
