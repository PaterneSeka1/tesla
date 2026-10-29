import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { MembershipService } from '../modules/progression/membership.service.js';
import { PathwayService } from '../modules/progression/pathway.service.js';
import { todayCivil } from '../modules/progression/age-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Traitement quotidien idempotent (à planifier une fois par jour, ex. cron du serveur) :
 * sorties de branche échues, puis recalcul des plans de rattrapage. Les statuts restent calculés
 * à la lecture : ce traitement ne fait qu'enregistrer les événements et les obligations.
 * Usage : `npm run jobs:daily -w @tesla/api [-- AAAA-MM-JJ]`.
 */
async function main(): Promise<void> {
  const logger = new Logger('TraitementQuotidien');
  const referenceDate = process.argv[2] ?? todayCivil();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error('Date attendue : AAAA-MM-JJ.');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const membership = await app.get(MembershipService).applyExits(referenceDate);
    const prisma = app.get(PrismaService);
    const pathway = app.get(PathwayService);
    const profiles = await prisma.scoutProfile.findMany({
      where: { membershipStatus: 'ACTIF' },
      select: { id: true },
    });
    let created = 0;
    for (const profile of profiles)
      created += await pathway.syncCatchUps(profile.id, referenceDate);
    logger.log(
      `Terminé : ${membership.exited} sortie(s), ${created} obligation(s) de rattrapage créée(s), ${membership.anomalies.length} anomalie(s).`,
    );
    for (const anomaly of membership.anomalies) logger.warn(anomaly);
  } finally {
    await app.close();
  }
}

await main();
