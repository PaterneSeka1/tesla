/**
 * Seed de développement, idempotent (peut être relancé sans dupliquer les données).
 * - Données de référence : étapes de progression, catégories du programme annuel (correspondance avec
 *   les étapes chargée « à confirmer », jamais confirmée par le seed) et programme 2026–2027 (vide :
 *   les séances officielles s'importent depuis le document du programme, aucune n'est inventée).
 * - Modules pédagogiques « Bases du scoutisme » importés en brouillon (prisma/seeds/), jamais approuvés
 *   ni publiés ; un module déjà importé n'est jamais modifié (écarts seulement signalés).
 * - 25 comptes de démonstration synthétiques (1 responsable, 4 chefs, 20 routiers), uniquement hors
 *   production et si DEMO_ACCOUNT_PASSWORD est défini dans l'environnement local (jamais versionné).
 *   19 routiers reçoivent un profil fictif réparti sur les quatre étapes ; `routier.demo` reste sans
 *   profil (test du rattachement). Un profil existant n'est jamais modifié. Aucune équipe n'est créée.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PROGRAMME_CATEGORIES, PROGRESSION_STAGES, type ProgressionStageCode } from '@tesla/shared';
import { type Role } from '../src/generated/prisma/enums.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { SCOUTISME_BASE_MODULES } from './seeds/scoutisme-base.seed.js';
import { formatImportReport, importSourceModules } from './seeds/source-modules.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');

interface DemoAccount {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** Étape du profil routier fictif ; absent = compte sans profil. */
  stageCode?: ProgressionStageCode;
}

interface ProgrammeCategorySeed {
  code: string;
  label: string;
  order: number;
  proposedStageCode: ProgressionStageCode;
}

/** Répartition fictive des 19 profils sur les étapes (tests d'éligibilité). */
const demoStage = (index: number): ProgressionStageCode =>
  index <= 8
    ? 'NOVICIAT'
    : index <= 14
      ? 'APPRENTISSAGE'
      : index <= 17
        ? 'COMPAGNONNAGE'
        : 'DEPART_ROUTIER';

/** 25 comptes fictifs (domaine réservé .test). `routier.demo` n'a pas de profil : à rattacher. */
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'responsable.demo@tesla.test',
    firstName: 'Démo',
    lastName: 'Responsable',
    role: 'RESPONSABLE',
  },
  ...['Un', 'Deux', 'Trois', 'Quatre'].map((label, index) => ({
    email: `chef${index + 1}.demo@tesla.test`,
    firstName: 'Démo',
    lastName: `Chef ${label}`,
    role: 'CHEF' as const,
  })),
  { email: 'routier.demo@tesla.test', firstName: 'Démo', lastName: 'Routier', role: 'ROUTIER' },
  ...Array.from({ length: 19 }, (_, i) => {
    const number = String(i + 1).padStart(2, '0');
    return {
      email: `routier${number}.demo@tesla.test`,
      firstName: 'Démo',
      lastName: `Routier ${number}`,
      role: 'ROUTIER' as const,
      stageCode: demoStage(i + 1),
    };
  }),
];
/** Date d'entrée fictive des profils de démonstration. */
const DEMO_JOINED_AT = new Date('2026-09-05');

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

  console.log(formatImportReport(await importSourceModules(prisma, SCOUTISME_BASE_MODULES)));

  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    console.log('Production : aucun compte de démonstration.');
  } else if (!demoPassword) {
    console.log('DEMO_ACCOUNT_PASSWORD non défini : aucun compte de démonstration.');
  } else if (demoPassword.length < 12) {
    throw new Error('DEMO_ACCOUNT_PASSWORD doit contenir au moins 12 caractères.');
  } else {
    const passwordHash = await hashPassword(demoPassword);
    let profiles = 0;
    let demoResponsableId: string | undefined;
    for (const { stageCode, ...account } of DEMO_ACCOUNTS) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        create: { ...account, passwordHash },
        update: { passwordHash, isActive: true },
        include: { scoutProfile: { select: { id: true } } },
      });
      if (account.role === 'RESPONSABLE') demoResponsableId = user.id;
      // Profil créé une seule fois : étape, équipe et résultats saisis pendant les tests sont conservés.
      if (!stageCode || user.scoutProfile) continue;
      const stage = await prisma.progressionStage.findUniqueOrThrow({ where: { code: stageCode } });
      await prisma.$transaction(async (tx) => {
        const profile = await tx.scoutProfile.create({
          data: {
            userId: user.id,
            firstName: account.firstName,
            lastName: account.lastName,
            joinedAt: DEMO_JOINED_AT,
            currentStageId: stage.id,
            currentStageSince: DEMO_JOINED_AT,
          },
        });
        const stageChange = tx as unknown as {
          scoutStageChange: {
            create: (args: {
              data: {
                scoutProfileId: string;
                kind: 'INSCRIPTION';
                toStageId: string;
                effectiveOn: Date;
                decidedById: string;
                reason: string;
              };
            }) => Promise<unknown>;
          };
        };
        await stageChange.scoutStageChange.create({
          data: {
            scoutProfileId: profile.id,
            kind: 'INSCRIPTION',
            toStageId: stage.id,
            effectiveOn: DEMO_JOINED_AT,
            // L'historique exige un auteur hors reprise : le responsable fictif (créé en premier).
            decidedById: demoResponsableId!,
            reason: 'Étape initiale fictive (seed de démonstration).',
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'scout_profile.created',
            entityType: 'ScoutProfile',
            entityId: profile.id,
            metadata: { source: 'seed-demo' },
          },
        });
      });
      profiles += 1;
    }
    const count = (role: Role) => DEMO_ACCOUNTS.filter((a) => a.role === role).length;
    console.log(
      `Seed : ${DEMO_ACCOUNTS.length} comptes de démonstration (${count('RESPONSABLE')} responsable, ${count('CHEF')} chefs, ${count('ROUTIER')} routiers), ${profiles} profil(s) routier créé(s).`,
    );
  }
} finally {
  await prisma.$disconnect();
}
