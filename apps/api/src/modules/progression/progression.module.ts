import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CatchUpRemindersService } from './catch-up-reminders.service.js';
import { StageAnnouncementsService } from './stage-announcements.service.js';
import { CompetenciesService } from './competencies.service.js';
import { CompetencyProposalsService } from './competency-proposals.service.js';
import { MembershipService } from './membership.service.js';
import { PathwayController } from './pathway.controller.js';
import { PathwayService } from './pathway.service.js';
import {
  CompetenciesController,
  CompetencyProposalsController,
  CompetencyValidationsController,
  ModuleStudiesController,
  MyProgressionController,
  ProgressionController,
  ScoutProgressionController,
} from './progression.controller.js';
import { PriorStagesController } from './prior-stages.controller.js';
import { PriorStagesService } from './prior-stages.service.js';
import { ProgressionService } from './progression.service.js';
import { ScoutProgressionService } from './scout-progression.service.js';
import { StageOverridesController } from './stage-overrides.controller.js';
import { StageOverridesService } from './stage-overrides.service.js';

/**
 * Progression des routiers : référentiel des étapes, historique des étapes (décisions du
 * responsable), référentiel de compétences, propositions et validations officielles, études de modules.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [
    ProgressionController,
    ScoutProgressionController,
    ModuleStudiesController,
    MyProgressionController,
    CompetenciesController,
    CompetencyProposalsController,
    CompetencyValidationsController,
    PathwayController,
    StageOverridesController,
    PriorStagesController,
  ],
  providers: [
    ProgressionService,
    ScoutProgressionService,
    CompetenciesService,
    CompetencyProposalsService,
    PathwayService,
    MembershipService,
    StageOverridesService,
    PriorStagesService,
    CatchUpRemindersService,
    StageAnnouncementsService,
  ],
  exports: [PathwayService, MembershipService, CatchUpRemindersService, StageAnnouncementsService],
})
export class ProgressionModule {}
