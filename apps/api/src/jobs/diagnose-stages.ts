import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { diagnoseStages, STAGE_ANOMALIES } from '../modules/progression/stage-diagnosis.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Diagnostic des étapes (D181), **lecture seule**, idempotent : routiers actifs sans étape
 * déterminée et historiques incohérents. Aucune écriture, aucune correction automatique. Le rapport
 * ne contient que des identifiants internes et des codes d'anomalie (aucune donnée personnelle).
 * Code de sortie 2 si au moins une anomalie est trouvée.
 * Usage : `npm run diagnose:stages -w @tesla/api [-- --json]`.
 */
async function main(): Promise<void> {
  const logger = new Logger('DiagnosticEtapes');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const report = await diagnoseStages(app.get(PrismaService));
    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      logger.log(
        `Référence ${report.referenceDate}, référentiel ${report.ruleSetVersion ?? 'aucun'} : ` +
          `${report.activeProfiles} routier(s) actif(s), ${report.rows.length} fiche(s) à examiner.`,
      );
      for (const [code, count] of Object.entries(report.counts)) {
        logger.warn(
          `${code} (${count}) : ${STAGE_ANOMALIES[code as keyof typeof STAGE_ANOMALIES]}`,
        );
      }
      for (const row of report.rows)
        logger.warn(`${row.scoutProfileId} : ${row.anomalies.join(', ')}`);
    }
    if (report.rows.length > 0) process.exitCode = 2;
  } finally {
    await app.close();
  }
}

await main();
