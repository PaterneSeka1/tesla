import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AcceptReviewInput,
  acceptReviewInputSchema,
  type AttemptReasonInput,
  attemptReasonInputSchema,
  type CorrectionDetail,
  correctionDetailSchema,
  type CorrectionListItem,
  correctionListItemSchema,
  type CorrectionListQuery,
  type CorrectionRevisionInput,
  correctionRevisionInputSchema,
  type Paginated,
  paginatedSchema,
  PAPER_DOCUMENTS,
  paperDocumentQuerySchema,
  type PreparePaperAttemptInput,
  preparePaperAttemptInputSchema,
  type SaveCorrectionInput,
  saveCorrectionInputSchema,
} from '@tesla/shared';
import { type Response } from 'express';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId, parseInput } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationAttemptsService } from './evaluation-attempts.service.js';
import { renderPaperDocument } from './paper-pdf.js';

const detail = { schema: openApiSchema(correctionDetailSchema) };

/**
 * Tentatives papier, correction des copies (chefs) et examen des résultats (responsable).
 * Le code de tentative sert de clé de recherche, jamais d'authentification : chaque route exige
 * une session et vérifie la permission dans le service.
 */
@ApiTags('Tentatives et corrections')
@ApiCookieAuth()
@Controller()
export class EvaluationAttemptsController {
  constructor(private readonly attempts: EvaluationAttemptsService) {}

  @Post('paper-attempts')
  @ApiOperation({
    summary: 'Préparer une tentative papier (routier avec ou sans compte)',
    description: 'Éligibilité vérifiée ; code NT-AAAA-NNNNNN attribué par le serveur.',
  })
  @ApiBody({ schema: openApiSchema(preparePaperAttemptInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async preparePaper(
    @CurrentActor() actor: Actor,
    @Body() body: PreparePaperAttemptInput,
  ): Promise<CorrectionDetail> {
    const attempt = await this.attempts.preparePaper(actor, body);
    return this.attempts.detail(actor, { id: attempt.id });
  }

  @Get('paper-attempts/:code/pdf')
  @ApiOperation({
    summary: 'Télécharger un document A4 (questionnaire, corrigé ou grille)',
    description:
      'Réimpression sans nouvelle tentative. Questionnaire : tentative préparée. Corrigé et grille : chefs et responsable.',
  })
  @ApiQuery({ name: 'document', required: false, enum: PAPER_DOCUMENTS })
  @ApiProduces('application/pdf')
  async pdf(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { document } = parseInput(paperDocumentQuerySchema, query);
    const data = await this.attempts.paperDocumentData(actor, code, document);
    const buffer = await renderPaperDocument(data, document);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${data.code}-${document}.pdf"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(buffer);
  }

  @Get('corrections')
  @ApiOperation({ summary: 'Copies à corriger et historique des tentatives (chefs, responsable)' })
  @ApiQuery({ name: 'search', required: false, description: 'Code, nom, matricule ou titre' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'mode', required: false })
  @ApiQuery({ name: 'evaluationId', required: false })
  @ApiQuery({ name: 'scoutProfileId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(correctionListItemSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: CorrectionListQuery,
  ): Promise<Paginated<CorrectionListItem>> {
    return this.attempts.list(actor, query);
  }

  @Get('corrections/:code')
  @ApiOperation({
    summary: 'Copie complète par code (version exacte, corrigé, réponses, historique)',
  })
  @ApiOkResponse(detail)
  get(@CurrentActor() actor: Actor, @Param('code') code: string): Promise<CorrectionDetail> {
    return this.attempts.detail(actor, { code });
  }

  @Post('corrections/:code/answers')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enregistrer la correction (brouillon)',
    description:
      'Transcription des réponses papier, notes des réponses libres, observations. Révision obligatoire ; motif si la copie était soumise.',
  })
  @ApiBody({ schema: openApiSchema(saveCorrectionInputSchema, 'input') })
  @ApiOkResponse(detail)
  save(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Body() body: SaveCorrectionInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.saveCorrection(actor, code, body);
  }

  @Post('corrections/:code/submit-review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soumettre le résultat corrigé au responsable' })
  @ApiBody({ schema: openApiSchema(correctionRevisionInputSchema, 'input') })
  @ApiOkResponse(detail)
  submitReview(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Body() body: CorrectionRevisionInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.submitReview(actor, code, body);
  }

  @Post('corrections/:code/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler une tentative (motif obligatoire, code conservé)' })
  @ApiBody({ schema: openApiSchema(attemptReasonInputSchema, 'input') })
  @ApiOkResponse(detail)
  cancel(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Body() body: AttemptReasonInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.cancel(actor, code, body);
  }

  @Get('admin/attempts/pending-review')
  @ApiOperation({ summary: 'Résultats soumis en attente d’examen (responsable)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(correctionListItemSchema)) })
  pendingReview(
    @CurrentActor() actor: Actor,
    @Query() query: CorrectionListQuery,
  ): Promise<Paginated<CorrectionListItem>> {
    return this.attempts.pendingReview(actor, query);
  }

  @Get('admin/attempts/:id')
  @ApiOperation({ summary: 'Résultat complet à examiner' })
  @ApiOkResponse(detail)
  adminGet(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<CorrectionDetail> {
    return this.attempts.detail(actor, { id: parseId(id) });
  }

  @Post('admin/attempts/:id/accept-review')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Accepter le résultat corrigé',
    description: 'N’est ni une validation officielle d’acquis ni un changement d’étape.',
  })
  @ApiBody({ schema: openApiSchema(acceptReviewInputSchema, 'input') })
  @ApiOkResponse(detail)
  accept(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: AcceptReviewInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.acceptReview(actor, parseId(id), body);
  }

  @Post('admin/attempts/:id/request-correction')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demander une nouvelle correction (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(attemptReasonInputSchema, 'input') })
  @ApiOkResponse(detail)
  requestCorrection(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: AttemptReasonInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.requestCorrection(actor, parseId(id), body);
  }

  @Post('admin/attempts/:id/reopen')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rouvrir un résultat déjà examiné (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(attemptReasonInputSchema, 'input') })
  @ApiOkResponse(detail)
  reopen(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: AttemptReasonInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.reopen(actor, parseId(id), body);
  }
}
