import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller.js';
import { DashboardsService } from './dashboards.service.js';

/** Tableaux de bord par rôle et statistiques (lecture seule, données PostgreSQL uniquement). */
@Module({
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
