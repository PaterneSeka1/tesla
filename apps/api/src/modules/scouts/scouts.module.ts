import { Module } from '@nestjs/common';
import { ObservationsController } from './observations.controller.js';
import { ObservationsService } from './observations.service.js';
import { ScoutProfilesService } from './scout-profiles.service.js';
import { ScoutsController } from './scouts.controller.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

/**
 * Profils routiers (avec ou sans compte), matricules, équipes, historique des affectations
 * et observations d'accompagnement.
 */
@Module({
  controllers: [ScoutsController, TeamsController, ObservationsController],
  providers: [ScoutProfilesService, TeamsService, ObservationsService],
  exports: [ScoutProfilesService, TeamsService],
})
export class ScoutsModule {}
