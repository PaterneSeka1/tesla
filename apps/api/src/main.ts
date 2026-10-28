import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { ENV } from './config/config.module.js';
import { type Env } from './config/env.js';
import { loadRootEnvFile } from './config/load-env-file.js';

loadRootEnvFile();

const app = await NestFactory.create(AppModule, {
  logger:
    process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error', 'fatal']
      : ['log', 'warn', 'error', 'fatal', 'debug'],
});
const env = app.get<Env>(ENV);
configureApp(app, env);
app.enableShutdownHooks();

await app.listen(env.API_PORT);
Logger.log(`API disponible sur http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
if (env.SWAGGER_ENABLED) {
  Logger.log(`Swagger : http://localhost:${env.API_PORT}/api/docs`, 'Bootstrap');
}
