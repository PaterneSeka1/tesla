/**
 * Seed de développement : uniquement les données de référence (étapes de progression).
 * Aucun compte utilisateur n'est créé tant que l'authentification n'est pas opérationnelle.
 * Idempotent : peut être relancé sans dupliquer les données.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PROGRESSION_STAGES } from '@tesla/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');

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
  console.log(`Seed terminé : ${PROGRESSION_STAGES.length} étapes de progression.`);
} finally {
  await prisma.$disconnect();
}
