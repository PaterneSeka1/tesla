import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { ActivitiesController, ProgrammesController } from './programmes.controller.js';
import { ProgrammeImportService } from './programme-import.service.js';
import { ProgrammesService } from './programmes.service.js';

/**
 * Programme annuel de la communauté (catégories, import Markdown ou Excel prévisualisable et idempotent), activités
 * du programme et supplémentaires, comptes rendus et présences.
 */
@Module({
  controllers: [ProgrammesController, ActivitiesController],
  providers: [ProgrammesService, ProgrammeImportService, ActivitiesService],
})
export class ProgrammesModule {}
