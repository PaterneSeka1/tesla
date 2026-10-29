/**
 * Seed de développement, idempotent (peut être relancé sans dupliquer les données).
 * - Données de référence : étapes de progression, catégories du programme annuel (correspondance avec
 *   les étapes chargée « à confirmer », jamais confirmée par le seed) et programme 2026–2027 (vide :
 *   les séances officielles s'importent depuis le document du programme, aucune n'est inventée).
 * - Modules pédagogiques « Bases du scoutisme » importés en brouillon (prisma/seeds/), jamais approuvés
 *   ni publiés ; un module déjà importé n'est jamais modifié (écarts seulement signalés).
 * - Comptes de démonstration synthétiques, uniquement hors production et si DEMO_ACCOUNT_PASSWORD
 *   est défini dans l'environnement local (jamais versionné). Aucun routier ni aucune équipe n'est créé.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PROGRAMME_CATEGORIES, PROGRESSION_STAGES } from '@tesla/shared';
import { type Role } from '../src/generated/prisma/enums.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { SCOUTISME_BASE_MODULES } from './seeds/scoutisme-base.seed.js';
import { formatImportReport, importSourceModules } from './seeds/source-modules.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');

/** Comptes fictifs (domaine réservé .test). Le routier de démonstration n'a pas de profil : à rattacher. */
const DEMO_ACCOUNTS: { email: string; firstName: string; lastName: string; role: Role }[] = [
  {
    email: 'responsable.demo@tesla.test',
    firstName: 'Démo',
    lastName: 'Responsable',
    role: 'RESPONSABLE',
  },
  { email: 'chef1.demo@tesla.test', firstName: 'Démo', lastName: 'Chef Un', role: 'CHEF' },
  { email: 'chef2.demo@tesla.test', firstName: 'Démo', lastName: 'Chef Deux', role: 'CHEF' },
  { email: 'routier.demo@tesla.test', firstName: 'Démo', lastName: 'Routier', role: 'ROUTIER' },
];

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

  for (const category of PROGRAMME_CATEGORIES) {
    const stage = await prisma.progressionStage.findUniqueOrThrow({
      where: { code: category.proposedStageCode },
    });
    // Une catégorie existante n'est jamais modifiée : sa correspondance relève du responsable.
    await prisma.programmeCategory.upsert({
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
  await prisma.programme.upsert({
    where: { code: '2026-2027' },
    create: { code: '2026-2027', title: 'Programme annuel 2026–2027' },
    update: {},
  });
  console.log(
    `Seed : ${PROGRAMME_CATEGORIES.length} catégories du programme, programme 2026–2027.`,
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
    for (const account of DEMO_ACCOUNTS) {
      await prisma.user.upsert({
        where: { email: account.email },
        create: { ...account, passwordHash },
        update: { passwordHash, isActive: true },
      });
    }
    console.log(
      `Seed : ${DEMO_ACCOUNTS.length} comptes de démonstration (${DEMO_ACCOUNTS.map((a) => a.email).join(', ')}).`,
    );
  }
} finally {
  await prisma.$disconnect();
}
