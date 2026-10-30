import { PROGRAMME_CATEGORIES, PROGRESSION_STAGES } from '@tesla/shared';
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
    leadership_assignments, delegations, leadership_mandates, scout_years, catch_up_obligations, route_membership_events,
    age_stage_rules, age_rule_sets,
    competency_evidences, competency_proposal_events, competency_validations, competency_proposals,
    competency_modules, activity_competencies, competencies,
    activity_attendances, activity_events, activity_categories, activity_modules, module_studies,
    activities, programmes, programme_categories, scout_stage_changes,
    module_text_links, module_source_imports, module_version_events, module_resources, module_lessons, module_collaborators, module_versions,
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
