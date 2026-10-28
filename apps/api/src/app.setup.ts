import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@tesla/shared';
import { APP_VERSION } from './config/app-version.js';
import { type Env } from './config/env.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { requestLogger } from './common/request-logger.middleware.js';

/** Configuration HTTP commune au démarrage réel et aux tests e2e. */
export function configureApp(app: INestApplication, env: Env): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestLogger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true, // sessions par cookie httpOnly prévues
  });

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Nikola Tesla Académie — API')
      .setDescription('API REST de la plateforme pédagogique de la Communauté Nikola Tesla.')
      .setVersion(APP_VERSION)
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
  }
}
