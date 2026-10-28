import { Module } from '@nestjs/common';
import { ScoutsModule } from '../scouts/scouts.module.js';
import { EvaluationAttemptsService } from './evaluation-attempts.service.js';
import { EvaluationWaiversService } from './evaluation-waivers.service.js';

/**
 * Tentatives d'évaluation (en ligne, hors ligne, papier), codes uniques, dérogations.
 * Services uniquement : aucune route exposée avant l'authentification (voir docs/API.md).
 */
@Module({
  imports: [ScoutsModule],
  providers: [EvaluationAttemptsService, EvaluationWaiversService],
  exports: [EvaluationAttemptsService, EvaluationWaiversService],
})
export class EvaluationsModule {}
