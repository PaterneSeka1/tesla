import { PROGRESSION_STAGES } from '@tesla/shared';
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
    evaluation_attempt_events, evaluation_attempts, evaluation_waivers, evaluation_versions, evaluations,
    attempt_code_counters, team_assignments, teams, scout_profiles, sessions, audit_logs, users,
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
}
