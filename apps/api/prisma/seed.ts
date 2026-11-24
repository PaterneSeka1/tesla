/**
 * Seed de développement, idempotent (peut être relancé sans dupliquer les données).
 * - Données de référence : étapes de progression, catégories du programme annuel (correspondance avec
 *   les étapes chargée « à confirmer », jamais confirmée par le seed) et programme 2026–2027 (vide :
 *   les séances officielles s'importent depuis le document du programme, aucune n'est inventée).
 * - Modules pédagogiques « Bases du scoutisme » importés en brouillon (prisma/seeds/), jamais approuvés
 *   ni publiés ; un module déjà importé n'est jamais modifié (écarts seulement signalés).
 * - Communauté de démonstration (`seeds/demo-community.ts`), uniquement hors production et si
 *   DEMO_ACCOUNT_PASSWORD est défini dans l'environnement local (jamais versionné) : encadrement
 *   désigné, routiers sur les quatre étapes, équipes, cas particuliers, catalogue mis en service et
 *   module d'entraînement soumis au plein. Personnes inventées, adresses non délivrables.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PROGRAMME_CATEGORIES, PROGRESSION_STAGES, type ProgressionStageCode } from '@tesla/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  seedAgeRuleSet2026_2,
  seedAgeRuleSet2026_3,
  seedInitialAgeRuleSet,
} from './seeds/age-rules.seed.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from './seeds/route-bibliotheque.seed.js';
import { seedDemoCommunity } from './seeds/demo-community.js';
import { SCOUTISME_BASE_MODULES } from './seeds/scoutisme-base.seed.js';
import { formatImportReport, importSourceModules } from './seeds/source-modules.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');

interface ProgrammeCategorySeed {
  code: string;
  label: string;
  order: number;
  proposedStageCode: ProgressionStageCode;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  for (const stage of PROGRESSION_STAGES) {
    const data = {
      name: stage.name,
      programmeLabel: stage.programmeLabel,
      badge: stage.badge,
      position: stage.order,
    };
    await prisma.progressionStage.upsert({
      where: { code: stage.code },
      create: { code: stage.code, ...data },
      update: data,
    });
  }
  console.log(`Seed : ${PROGRESSION_STAGES.length} étapes de progression.`);

  for (const category of PROGRAMME_CATEGORIES as unknown as readonly ProgrammeCategorySeed[]) {
    const stage = await prisma.progressionStage.findUniqueOrThrow({
      where: { code: category.proposedStageCode },
    });
    // Une catégorie existante n'est jamais modifiée : sa correspondance relève du responsable.
    const programmeCategory = (
      prisma as unknown as {
        programmeCategory: {
          upsert: (args: {
            where: { code: string };
            create: {
              code: string;
              label: string;
              position: number;
              stageId: string;
              correspondenceValidated: boolean;
            };
            update: Record<string, never>;
          }) => Promise<unknown>;
        };
      }
    ).programmeCategory;
    await programmeCategory.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        label: category.label,
        position: category.order,
        stageId: stage.id,
        correspondenceValidated: false,
      },
      update: {},
    });
  }
  const programme = (
    prisma as unknown as {
      programme: {
        upsert: (args: {
          where: { code: string };
          create: { code: string; title: string };
          update: Record<string, never>;
        }) => Promise<unknown>;
      };
    }
  ).programme;
  await programme.upsert({
    where: { code: '2026-2027' },
    create: { code: '2026-2027', title: 'Programme annuel 2026–2027' },
    update: {},
  });
  console.log(
    `Seed : ${(PROGRAMME_CATEGORIES as readonly unknown[]).length} catégories du programme, programme 2026–2027.`,
  );

  await seedInitialAgeRuleSet(prisma);
  await seedAgeRuleSet2026_2(prisma);
  await seedAgeRuleSet2026_3(prisma);

  console.log(
    formatImportReport(
      await importSourceModules(prisma, [
        ...SCOUTISME_BASE_MODULES,
        ...FUNDAMENTAL_TEXTS,
        ...ROUTE_MODULES,
      ]),
    ),
  );

  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    console.log('Production : aucun compte de démonstration.');
  } else if (!demoPassword) {
    console.log('DEMO_ACCOUNT_PASSWORD non défini : aucun compte de démonstration.');
  } else if (demoPassword.length < 12) {
    throw new Error('DEMO_ACCOUNT_PASSWORD doit contenir au moins 12 caractères.');
  } else {
    await seedDemoCommunity(prisma, demoPassword);
  }
} finally {
  await prisma.$disconnect();
}
