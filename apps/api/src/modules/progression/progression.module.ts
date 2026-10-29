import { Module } from '@nestjs/common';
import { CompetenciesService } from './competencies.service.js';
import { CompetencyProposalsService } from './competency-proposals.service.js';
import {
  CompetenciesController,
  CompetencyProposalsController,
  CompetencyValidationsController,
  ModuleStudiesController,
  MyProgressionController,
  ProgressionController,
  ScoutProgressionController,
} from './progression.controller.js';
import { ProgressionService } from './progression.service.js';
import { ScoutProgressionService } from './scout-progression.service.js';

/**
 * Progression des routiers : référentiel des étapes, historique des étapes (décisions du
 * responsable), référentiel de compétences, propositions et validations officielles, études de modules.
 */
@Module({
  controllers: [
    ProgressionController,
    ScoutProgressionController,
    ModuleStudiesController,
    MyProgressionController,
    CompetenciesController,
    CompetencyProposalsController,
    CompetencyValidationsController,
  ],
  providers: [
    ProgressionService,
    ScoutProgressionService,
    CompetenciesService,
    CompetencyProposalsService,
  ],
})
export class ProgressionModule {}
