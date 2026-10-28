import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PedagogyModule } from './modules/pedagogy/pedagogy.module.js';
import { ProgrammesModule } from './modules/programmes/programmes.module.js';
import { ProgressionModule } from './modules/progression/progression.module.js';
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
    ProgrammesModule,
    AuditModule,
  ],
})
export class AppModule {}
