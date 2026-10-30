import { Module } from '@nestjs/common';
import { LeadershipController } from './leadership.controller.js';
import { LeadershipService } from './leadership.service.js';

/** Encadrement : fonctions (plein, adjoint, assistants) désignées par l'administrateur (D132). */
@Module({
  controllers: [LeadershipController],
  providers: [LeadershipService],
})
export class LeadershipModule {}
