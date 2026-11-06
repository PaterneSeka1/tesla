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
import { seedInitialAgeRuleSet } from './seeds/age-rules.seed.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from './seeds/route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from './seeds/scoutisme-base.seed.js';
import { formatImportReport, importSourceModules } from './seeds/source-modules.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');

interface DemoAccount {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** Étape visée par la date de naissance fictive du profil routier ; absent = compte sans profil. */
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

/**
 * 26 comptes fictifs (domaine réservé .test). `routier.demo` n'a pas de profil : à rattacher.
 * L'encadrement n'a aucune fonction d'office (D132) : l'administrateur fictif désigne le
 * responsable plein, l'adjoint et les assistants depuis l'écran « Communauté ».
 */
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'responsable.demo@tesla.test',
    firstName: 'Démo',
    lastName: 'Responsable',
    role: 'ENCADREMENT',
  },
  ...['Un', 'Deux', 'Trois', 'Quatre'].map((label, index) => ({
    email: `chef${index + 1}.demo@tesla.test`,
    firstName: 'Démo',
    lastName: `Encadrant ${label}`,
    role: 'ENCADREMENT' as const,
  })),
  {
    email: 'admin.demo@tesla.test',
    firstName: 'Démo',
    lastName: 'Administration',
    role: 'ADMINISTRATEUR',
  },
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

/** Date de naissance fictive : 18 ans et 10 jours (noviciat), 19 ou 20 ans pour les autres étapes. */
function demoBirthDate(stageCode: ProgressionStageCode): Date {
  const years = stageCode === 'NOVICIAT' ? 18 : stageCode === 'APPRENTISSAGE' ? 19 : 20;
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  if (stageCode === 'NOVICIAT') date.setUTCDate(date.getUTCDate() - 10);
  return date;
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
    const passwordHash = await hashPassword(demoPassword);
    let profiles = 0;
    for (const { stageCode, ...account } of DEMO_ACCOUNTS) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        create: { ...account, passwordHash },
        update: { passwordHash, isActive: true },
        include: { scoutProfile: { select: { id: true } } },
      });
      // Profil créé une seule fois : étape, équipe et résultats saisis pendant les tests sont conservés.
      if (!stageCode || user.scoutProfile) continue;
      // L'étape n'est jamais saisie (D173) : une date de naissance fictive la produit par le calcul
      // selon l'âge (noviciat dans les 10 jours de ses 18 ans ; au-delà, étape non déterminée tant que
      // le référentiel ne définit pas d'autres périodes).
      const birthDate = demoBirthDate(stageCode);
      await prisma.$transaction(async (tx) => {
        const profile = await tx.scoutProfile.create({
          data: {
            userId: user.id,
            firstName: account.firstName,
            lastName: account.lastName,
            joinedAt: DEMO_JOINED_AT,
            birthDate,
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
      `Seed : ${DEMO_ACCOUNTS.length} comptes de démonstration (${count('ENCADREMENT')} encadrement, ${count('ADMINISTRATEUR')} administration, ${count('ROUTIER')} routiers), ${profiles} profil(s) routier créé(s).`,
    );
  }
} finally {
  await prisma.$disconnect();
}
