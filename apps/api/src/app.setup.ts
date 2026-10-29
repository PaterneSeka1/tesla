import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, CSRF_HEADER, SESSION_COOKIE_NAME } from '@tesla/shared';
import { APP_VERSION } from './config/app-version.js';
import { type Env } from './config/env.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { csrfProtection } from './common/csrf.middleware.js';
import { requestLogger } from './common/request-logger.middleware.js';

/** Configuration HTTP commune au démarrage réel et aux tests e2e. */
export function configureApp(app: INestApplication, env: Env): void {
  app.setGlobalPrefix(API_PREFIX);
  if (env.TRUST_PROXY) {
    // Adresse IP réelle du client (limitation des tentatives de connexion) derrière Nginx.
    (app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set(
      'trust proxy',
      1,
    );
  }
  app.use(requestLogger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true, // sessions par cookie httpOnly
    allowedHeaders: ['Content-Type', 'Accept', CSRF_HEADER],
  });
  app.use(csrfProtection(env.CORS_ORIGINS));

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Nikola Tesla Académie — API')
      .setDescription('API REST de la plateforme pédagogique de la Communauté Nikola Tesla.')
      .setVersion(APP_VERSION)
      .addCookieAuth(SESSION_COOKIE_NAME)
      .addApiKey({ type: 'apiKey', in: 'header', name: CSRF_HEADER }, 'csrf')
      .addSecurityRequirements('csrf')
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
  }
}
