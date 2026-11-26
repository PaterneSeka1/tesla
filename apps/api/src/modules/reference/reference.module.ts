import { Module } from '@nestjs/common';
import { ReferenceController } from './reference.controller.js';
import { ReferenceService } from './reference.service.js';

/** Référentiel scout (D220). */
@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService],
})
export class ReferenceModule {}
