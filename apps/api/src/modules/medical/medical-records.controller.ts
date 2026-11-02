import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Put,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  deleteMedicalRecordInputSchema,
  type MedicalRecord,
  medicalRecordSchema,
  saveMedicalRecordInputSchema,
} from '@tesla/shared';
import { type Response } from 'express';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { renderMedicalPdf } from './medical-pdf.js';
import { MedicalRecordsService } from './medical-records.service.js';

/**
 * Fiche médicale du compte connecté, et de lui seul : aucune route ne désigne une autre personne,
 * donc aucune URL prévisible vers la fiche d'autrui. Réponses jamais mises en cache (`no-store`).
 */
@ApiTags('Fiche médicale')
@ApiCookieAuth()
@ApiServiceUnavailableResponse({ description: 'MEDICAL_RECORDS_UNAVAILABLE (clé non configurée)' })
@Controller('me/medical-record')
export class MedicalRecordsController {
  constructor(private readonly medical: MedicalRecordsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lire sa fiche médicale (null si aucune)' })
  @ApiOkResponse({ schema: openApiSchema(medicalRecordSchema) })
  read(@CurrentActor() actor: Actor): Promise<MedicalRecord> {
    return this.medical.read(actor);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Créer ou modifier sa fiche médicale',
    description:
      'Création avec `expectedRevision: null`, sinon révision lue (409 si elle a changé).',
  })
  @ApiBody({ schema: openApiSchema(saveMedicalRecordInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(medicalRecordSchema) })
  @ApiConflictResponse({ description: 'MEDICAL_RECORD_CHANGED' })
  save(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<MedicalRecord> {
    return this.medical.save(actor, body);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer définitivement sa fiche médicale' })
  @ApiBody({ schema: openApiSchema(deleteMedicalRecordInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'MEDICAL_RECORD_CHANGED' })
  remove(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<void> {
    return this.medical.remove(actor, body);
  }

  @Get('pdf')
  @ApiOperation({ summary: 'Télécharger sa fiche médicale (PDF A4 aux couleurs de la communauté)' })
  @ApiProduces('application/pdf')
  @ApiNotFoundResponse({ description: 'MEDICAL_RECORD_NOT_FOUND' })
  async pdf(
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { holder, record } = await this.medical.printable(actor);
    const buffer = await renderMedicalPdf({
      holder,
      data: record.data,
      updatedAt: new Date(record.updatedAt),
    });
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="fiche-medicale.pdf"',
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(buffer);
  }
}
