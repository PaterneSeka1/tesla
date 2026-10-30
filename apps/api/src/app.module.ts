import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DashboardsModule } from './modules/dashboards/dashboards.module.js';
import { LeadershipModule } from './modules/leadership/leadership.module.js';
import { EvaluationsModule } from './modules/evaluations/evaluations.module.js';
import { PedagogyModule } from './modules/pedagogy/pedagogy.module.js';
import { ProgrammesModule } from './modules/programmes/programmes.module.js';
import { ProgressionModule } from './modules/progression/progression.module.js';
import { ScoutsModule } from './modules/scouts/scouts.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PedagogyModule,
    ProgressionModule,
    LeadershipModule,
    ProgrammesModule,
    ScoutsModule,
    EvaluationsModule,
    DashboardsModule,
    AuditModule,
  ],
  /** Écritures rejouées par la file de synchronisation des appareils (D110). */
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class AppModule {}
