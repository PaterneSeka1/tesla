import { OfflineController } from './offline.controller.js';
import { OfflineService } from './offline.service.js';
import { Module } from '@nestjs/common';
import { ScoutsModule } from '../scouts/scouts.module.js';
import { EvaluationAttemptsController } from './evaluation-attempts.controller.js';
import { EvaluationAttemptsService } from './evaluation-attempts.service.js';
import { EvaluationEditorController } from './evaluation-editor.controller.js';
import { EvaluationEditorService } from './evaluation-editor.service.js';
import { EvaluationReviewController } from './evaluation-review.controller.js';
import { EvaluationReviewService } from './evaluation-review.service.js';
import { EvaluationSessionsController } from './evaluation-sessions.controller.js';
import { EvaluationSessionsService } from './evaluation-sessions.service.js';
import { EvaluationWaiversController } from './evaluation-waivers.controller.js';
import { EvaluationWaiversService } from './evaluation-waivers.service.js';

/**
 * Évaluations : rédaction et approbation des questionnaires, passation en ligne, tentatives papier
 * (codes uniques, PDF), correction par les chefs, examen par le responsable, dérogations.
 * Aucune route ne modifie l'étape d'un routier (validation officielle exclusivement humaine).
 */
@Module({
  imports: [ScoutsModule],
  controllers: [
    OfflineController,
    EvaluationEditorController,
    EvaluationReviewController,
    EvaluationSessionsController,
    EvaluationAttemptsController,
    EvaluationWaiversController,
  ],
  providers: [
    OfflineService,
    EvaluationEditorService,
    EvaluationReviewService,
    EvaluationSessionsService,
    EvaluationAttemptsService,
    EvaluationWaiversService,
  ],
  exports: [EvaluationAttemptsService, EvaluationWaiversService],
})
export class EvaluationsModule {}
