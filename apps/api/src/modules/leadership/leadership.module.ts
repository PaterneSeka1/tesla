import { Module } from '@nestjs/common';
import { LeadershipController } from './leadership.controller.js';
import { LeadershipService } from './leadership.service.js';

/** Encadrement : années scoutes, mandats annuels (plein, adjoint, assistants) et délégations. */
@Module({
  controllers: [LeadershipController],
  providers: [LeadershipService],
})
export class LeadershipModule {}
