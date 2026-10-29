import { Module } from '@nestjs/common';
import { ProgressionController } from './progression.controller.js';
import { ProgressionService } from './progression.service.js';

/**
 * Progression des routiers. Exposé : référentiel des étapes.
 * Évaluations en ligne, déblocages et validations officielles : à venir (voir docs/ROADMAP.md).
 */
@Module({
  controllers: [ProgressionController],
  providers: [ProgressionService],
})
export class ProgressionModule {}
