import { Module } from '@nestjs/common';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsService } from './medical-records.service.js';

/** Fiches médicales personnelles (D135–D137), séparées des permissions pédagogiques. */
@Module({
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
})
export class MedicalModule {}
