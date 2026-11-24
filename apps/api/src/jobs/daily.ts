import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { LoginRateLimiter } from '../modules/auth/login-rate-limiter.js';
import { MembershipService } from '../modules/progression/membership.service.js';
import { CatchUpRemindersService } from '../modules/progression/catch-up-reminders.service.js';
import { PathwayService } from '../modules/progression/pathway.service.js';
import { StageAnnouncementsService } from '../modules/progression/stage-announcements.service.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import { todayCivil } from '../modules/progression/age-rules.js';
import { StoredFilesService } from '../storage/stored-files.service.js';

/**
 * Traitement quotidien idempotent (à planifier une fois par jour, ex. cron du serveur) :
 * sorties de branche échues, recalcul des plans de rattrapage, rappels de rattrapage (D192) et
 * annonces de passage d'étape (D193), puis envoi facultatif par e-mail. Les statuts restent calculés
 * à la lecture : ce traitement ne fait qu'enregistrer les événements et les obligations.
 * Une date de référence future est refusée : une sortie enregistrée est définitive.
 * Purge aussi les compteurs de limitation des tentatives de connexion expirés, efface du stockage
 * objet les envois jamais confirmés et journalise les indicateurs de stockage (sans contenu, D143).
 * Usage : `npm run jobs:daily -w @tesla/api [-- AAAA-MM-JJ]`.
 */
async function main(): Promise<void> {
  const logger = new Logger('TraitementQuotidien');
  const referenceDate = process.argv[2] ?? todayCivil();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error('Date attendue : AAAA-MM-JJ.');
  if (referenceDate > todayCivil()) throw new Error('Date de référence future refusée.');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const membership = await app.get(MembershipService).applyExits(referenceDate);
    const { created, failedProfileIds } = await app
      .get(PathwayService)
      .syncAllCatchUps(referenceDate);
    logger.log(
      `Terminé : ${membership.exited} sortie(s), ${created} obligation(s) de rattrapage créée(s), ${membership.anomalies.length} anomalie(s).`,
    );
    for (const anomaly of membership.anomalies) logger.warn(anomaly);
    // Identifiants internes seulement, jamais de donnée personnelle ; relance sans risque.
    for (const id of failedProfileIds) logger.error(`Plan de rattrapage non recalculé : ${id}.`);
    if (failedProfileIds.length > 0) process.exitCode = 1;
    // Rappels de rattrapage (D192) après le recalcul des plans, puis envoi facultatif par e-mail.
    const reminders = await app.get(CatchUpRemindersService).dispatch(referenceDate);
    // Annonce des passages d'étape (D193), avant l'envoi des e-mails.
    const announcements = await app.get(StageAnnouncementsService).dispatch(referenceDate);
    const mails = await app.get(NotificationsService).deliverEmails();
    logger.log(
      `Rappels : ${reminders.created} rattrapage(s), ${announcements.created} passage(s) d’étape, ${mails.sent} e-mail(s) envoyé(s), ${mails.failed} échec(s).`,
    );
    const purged = await app.get(LoginRateLimiter).purge();
    logger.log(`${purged} compteur(s) de connexion expiré(s) purgé(s).`);
    const files = app.get(StoredFilesService);
    const cleanup = await files.cleanupAbandoned();
    const stats = await files.stats();
    logger.log(
      `Stockage : ${cleanup.abandoned} envoi(s) abandonné(s) nettoyé(s), ${cleanup.failed} report(s) ; ` +
        `fichiers ${JSON.stringify(stats.byStatus)} ; ${stats.orphans} fichier(s) validé(s) sans référence.`,
    );
    if (cleanup.failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();
