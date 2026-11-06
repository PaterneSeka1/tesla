import {
  addCalendarDays,
  addCalendarMonths,
  civilDateAt,
  PROGRAMME_CATEGORIES,
  PROGRESSION_STAGES,
  type ProgressionStageCode,
} from '@tesla/shared';
import { type Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** URL de la base d'intégration, refusée si elle ne désigne pas une base « _test ». */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL est requis pour les tests d’intégration.');
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Base « ${name} » refusée : le nom doit se terminer par « _test ».`);
  }
  return url;
}

export function createTestPrisma(): PrismaService {
  return new PrismaService({ DATABASE_URL: testDatabaseUrl() } as Env);
}

/** Vide la base de test (TRUNCATE ne déclenche pas les triggers de ligne) et recharge les étapes. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE
    medical_records, leadership_assignments, delegations, leadership_mandates, scout_years, catch_up_obligations, route_membership_events,
    age_stage_rules, age_rule_sets,
    competency_evidences, competency_proposal_events, competency_validations, competency_proposals,
    competency_modules, activity_competencies, competencies,
    activity_attendances, activity_events, activity_categories, activity_modules, module_studies,
    activities, programme_imports, programmes, programme_categories, scout_stage_changes,
    module_text_links, module_source_revisions, module_source_imports, module_version_events, module_resources, stored_files, module_lessons, module_collaborators, module_versions,
    pedagogical_modules,
    attempt_answers, evaluation_attempt_events, evaluation_attempts, evaluation_waivers,
    evaluation_version_events, evaluation_answer_options, evaluation_questions, evaluation_versions,
    evaluations,
    attempt_code_counters, team_assignments, teams, scout_observation_revisions, scout_observations,
    scout_profiles, sessions, audit_logs, client_operations, account_tokens, auth_throttles, users,
    progression_stages CASCADE`);
  for (const stage of PROGRESSION_STAGES) {
    await prisma.progressionStage.create({
      data: {
        code: stage.code,
        name: stage.name,
        programmeLabel: stage.programmeLabel,
        badge: stage.badge,
        position: stage.order,
      },
    });
  }
  for (const category of PROGRAMME_CATEGORIES) {
    await prisma.programmeCategory.create({
      data: {
        code: category.code,
        label: category.label,
        position: category.order,
        stage: { connect: { code: category.proposedStageCode } },
      },
    });
  }
  await prisma.programme.create({
    data: { code: '2026-2027', title: 'Programme annuel 2026–2027' },
  });
}

/**
 * Profils de test : les anciens rôles restent des raccourcis lisibles dans les scénarios.
 * - `RESPONSABLE` : encadrement désigné responsable plein (un seul à la fois : un nouveau
 *   `RESPONSABLE` remplace le précédent, qui garde les droits de l'encadrement) ;
 * - `CHEF` : encadrement sans fonction (consultation, rédaction, accompagnement ; aucune décision officielle).
 */
export type TestPersona = 'ROUTIER' | 'CHEF' | 'RESPONSABLE' | 'ADMINISTRATEUR';

export function personaRole(persona: TestPersona): 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR' {
  return persona === 'CHEF' || persona === 'RESPONSABLE' ? 'ENCADREMENT' : persona;
}

export async function grantPersona(
  prisma: PrismaService,
  userId: string,
  persona: TestPersona,
): Promise<void> {
  if (persona !== 'RESPONSABLE') return;
  await prisma.leadershipAssignment.updateMany({
    where: { function: 'PLEIN', endedAt: null },
    data: { endedAt: new Date(), endReason: 'Remplacement (tests)' },
  });
  await prisma.leadershipAssignment.create({
    data: { userId, function: 'PLEIN', reason: 'Désignation fictive (tests)' },
  });
}

/**
 * Référentiel d'âge **fictif**, réservé aux tests (D173) : périodes inventées pour couvrir les quatre
 * étapes et exercer l'éligibilité par étape calculée. Ce n'est en aucun cas une règle pédagogique ;
 * le référentiel réel (`2026.1`) ne définit que le noviciat et la sortie à 21 ans.
 */
export const TEST_AGE_RULE_SET_VERSION = 'test-fictif';

const TEST_PERIODS: Record<ProgressionStageCode, [number, number, number | null, number | null]> = {
  NOVICIAT: [18, 0, 18, 1],
  APPRENTISSAGE: [18, 1, 19, 0],
  COMPAGNONNAGE: [19, 0, 20, 0],
  DEPART_ROUTIER: [20, 0, null, null],
};

/** Installe (une fois par base remise à zéro) le référentiel fictif, en vigueur depuis 2000. */
export async function installTestAgeRules(prisma: PrismaService): Promise<void> {
  const existing = await prisma.ageRuleSet.findUnique({
    where: { version: TEST_AGE_RULE_SET_VERSION },
  });
  if (existing) return;
  const stages = await prisma.progressionStage.findMany();
  const created = await prisma.ageRuleSet
    .create({
      data: {
        version: TEST_AGE_RULE_SET_VERSION,
        sourceReference: 'Référentiel fictif des tests d’intégration (aucune valeur pédagogique).',
        branchExitAgeYears: 21,
        stages: {
          create: stages.map((stage) => {
            const [startYears, startMonths, endYears, endMonths] =
              TEST_PERIODS[stage.code as ProgressionStageCode];
            return {
              stageId: stage.id,
              startYears,
              startMonths,
              endYears,
              endMonths,
              sourceReference: 'Fictif (tests).',
            };
          }),
        },
      },
    })
    // Installation concurrente (appels parallèles) : le premier l'emporte.
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === 'P2002') return null;
      throw error;
    });
  if (!created) return;
  await prisma.ageRuleSet.update({
    where: { id: created.id },
    data: {
      status: 'EN_VIGUEUR',
      effectiveFrom: new Date('2000-01-01T00:00:00Z'),
      activatedAt: new Date(),
    },
  });
}

/** Date de naissance fictive plaçant aujourd'hui le routier dans l'étape demandée (référentiel fictif). */
export function birthDateForStage(
  code: ProgressionStageCode,
  today = civilDateAt(new Date()),
): Date {
  const [years, months] = TEST_PERIODS[code];
  // Dix jours après le début de la période : à l'abri d'un changement de date pendant les tests.
  const date = addCalendarDays(addCalendarMonths(today, -(years * 12 + months)), -10);
  return new Date(`${date}T00:00:00Z`);
}

/**
 * Données d'un profil de test dont l'étape **calculée** est `code` : l'étape ne se saisit plus
 * (D173), elle découle de la date de naissance et du référentiel fictif installé ici.
 */
export async function stageData(
  prisma: PrismaService,
  code: ProgressionStageCode,
): Promise<{ birthDate: Date }> {
  await installTestAgeRules(prisma);
  return { birthDate: birthDateForStage(code) };
}

/** Même date au format AAAA-MM-JJ (saisie par l'API). Installe le référentiel fictif. */
export async function birthDateIsoForStage(
  prisma: PrismaService,
  code: ProgressionStageCode,
): Promise<string> {
  return (await stageData(prisma, code)).birthDate.toISOString().slice(0, 10);
}
