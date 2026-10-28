import { Module } from '@nestjs/common';
import { ScoutProfilesService } from './scout-profiles.service.js';
import { TeamsService } from './teams.service.js';

/**
 * Profils routiers (avec ou sans compte), matricules, équipes et historique des affectations.
 * Services uniquement : aucune route exposée avant l'authentification (voir docs/API.md).
 */
@Module({
  providers: [ScoutProfilesService, TeamsService],
  exports: [ScoutProfilesService, TeamsService],
})
export class ScoutsModule {}
