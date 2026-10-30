import { parseArgs } from 'node:util';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { loadRootEnvFile } from '../config/load-env-file.js';
import { AccountsService } from '../modules/users/accounts.service.js';

/**
 * Installation : premier compte d'administration technique, sans mot de passe dans le code, la
 * ligne de commande ni l'environnement (D121). Affiche un lien d'activation à usage unique, valable
 * ACCOUNT_LINK_TTL_HOURS heures ; le titulaire y choisit lui-même son mot de passe.
 * Secours (`--recover`) : nouveau lien pour un administrateur existant (mot de passe perdu).
 * Usage : `npm run admin:create -w @tesla/api -- --email … --first-name … --last-name … [--web-url https://…]`
 *         `npm run admin:create -w @tesla/api -- --recover --email …`
 */
loadRootEnvFile();

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    'first-name': { type: 'string', default: 'Administration' },
    'last-name': { type: 'string', default: 'Technique' },
    'web-url': { type: 'string' },
    recover: { type: 'boolean', default: false },
  },
});

async function main(): Promise<void> {
  if (!values.email) throw new Error('--email est requis.');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const env = app.get<Env>(ENV);
    const link = await app.get(AccountsService).bootstrapAdministrator({
      email: values.email,
      firstName: values['first-name'],
      lastName: values['last-name'],
      recover: values.recover,
    });
    const webUrl = (values['web-url'] ?? env.CORS_ORIGINS[0] ?? '').replace(/\/$/, '');
    // Sortie standard uniquement (jamais dans les journaux applicatifs) : à transmettre au titulaire.
    process.stdout.write(
      `${link.purpose === 'ACTIVATION' ? 'Activation' : 'Réinitialisation'} — lien à usage unique, valable jusqu'au ${link.expiresAt} :\n${webUrl}/activation#${link.token}\n`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : String(error), 'Installation');
  process.exitCode = 1;
});
