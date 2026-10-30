import {
  civilDateAt,
  DELEGABLE_PERMISSIONS,
  PROGRAMME_CATEGORIES,
  PROGRESSION_STAGES,
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
    delegations, leadership_mandates, scout_years, catch_up_obligations, route_membership_events,
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
 * - `RESPONSABLE` : encadrement avec mandat de responsable plein en vigueur ; si un plein exerce déjà
 *   (un seul à la fois), mandat d'assistant et délégation de toutes les permissions délégables.
 * - `CHEF` : encadrement sans mandat (consultation, rédaction, accompagnement ; aucune décision officielle).
 */
export type TestPersona = 'ROUTIER' | 'CHEF' | 'RESPONSABLE' | 'ADMINISTRATEUR';

export function personaRole(persona: TestPersona): 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR' {
  return persona === 'CHEF' || persona === 'RESPONSABLE' ? 'ENCADREMENT' : persona;
}

/** Année scoute de test couvrant la date du jour (1er septembre → 31 août). */
export async function ensureTestScoutYear(
  prisma: PrismaService,
): Promise<{ id: string; startsOn: Date; endsOn: Date }> {
  const today = civilDateAt(new Date());
  const year = Number(today.slice(0, 4)) - (today.slice(5) < '09-01' ? 1 : 0);
  const label = `${year}-${year + 1}`;
  const existing = await prisma.scoutYear.findUnique({ where: { label } });
  if (existing) return existing;
  return prisma.scoutYear.create({
    data: {
      label,
      startsOn: new Date(`${year}-09-01T00:00:00Z`),
      endsOn: new Date(`${year + 1}-08-31T00:00:00Z`),
    },
  });
}

export async function grantPersona(
  prisma: PrismaService,
  userId: string,
  persona: TestPersona,
): Promise<void> {
  if (persona !== 'RESPONSABLE') return;
  const year = await ensureTestScoutYear(prisma);
  const today = new Date(`${civilDateAt(new Date())}T00:00:00Z`);
  const plein = await prisma.leadershipMandate.findFirst({
    where: {
      function: 'PLEIN',
      startsOn: { lte: today },
      endsOn: { gte: today },
      endedEarlyOn: null,
    },
  });
  const base = {
    userId,
    scoutYearId: year.id,
    startsOn: year.startsOn,
    endsOn: year.endsOn,
    kind: 'NOMINATION' as const,
    appointingAuthority: 'Autorité fictive (tests)',
  };
  if (!plein) {
    await prisma.leadershipMandate.create({ data: { ...base, function: 'PLEIN' } });
    return;
  }
  await prisma.leadershipMandate.create({ data: { ...base, function: 'ASSISTANT' } });
  await prisma.delegation.create({
    data: {
      delegatorId: plein.userId,
      delegateId: userId,
      permissions: [...DELEGABLE_PERMISSIONS],
      startsOn: year.startsOn,
      endsOn: year.endsOn,
      reason: 'Délégation fictive (tests)',
    },
  });
}
