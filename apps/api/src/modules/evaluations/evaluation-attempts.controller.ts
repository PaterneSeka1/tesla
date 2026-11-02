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
  type DistributionCandidates,
  distributionCandidatesSchema,
  type PaperBatchResult,
  paperBatchResultSchema,
  preparePaperBatchInputSchema,
  switchToPaperInputSchema,
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
import { createZip } from '../../common/zip-store.js';
import { renderPaperDocument, renderPaperQuestionnaires } from './paper-pdf.js';

/** Nom de fichier ASCII (archives lisibles partout) : « NT-2027-000125_KOUASSI_Eric.pdf ». */
function asciiFileName(...parts: string[]): string {
  return parts
    .join('_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

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
      'Réimpression sans nouvelle tentative. Questionnaire : tentative préparée. Corrigé et grille : responsable plein.',
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

  @Get('evaluations/:id/distribution')
  @ApiOperation({
    summary:
      'Routiers candidats à une distribution collective (éligibilité calculée par le serveur)',
  })
  @ApiOkResponse({ schema: openApiSchema(distributionCandidatesSchema) })
  distribution(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<DistributionCandidates> {
    return this.attempts.distributionCandidates(actor, parseId(id));
  }

  @Post('paper-batches')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Préparer les copies papier de plusieurs routiers (idempotent)',
    description:
      'Une copie encore préparée est réutilisée ; une tentative ouverte n’est jamais doublée ; un routier inéligible est ignoré avec sa raison. Renvoyer le même lot reprend un échec partiel.',
  })
  @ApiBody({ schema: openApiSchema(preparePaperBatchInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(paperBatchResultSchema) })
  prepareBatch(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<PaperBatchResult> {
    return this.attempts.preparePaperBatch(actor, body);
  }

  @Get('paper-batches/documents')
  @ApiOperation({
    summary: 'Questionnaires de plusieurs copies : PDF commun ou ZIP (un PDF par routier)',
    description: 'Lecture seule, jamais de corrigé. `codes` : codes séparés par des virgules.',
  })
  @ApiQuery({ name: 'codes', required: true })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'zip'] })
  @ApiProduces('application/pdf', 'application/zip')
  async batchDocuments(
    @CurrentActor() actor: Actor,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { format, copies } = await this.attempts.paperBatchDocumentData(actor, query);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'pdf') {
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="questionnaires-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      });
      return new StreamableFile(await renderPaperQuestionnaires(copies));
    }
    const entries = [];
    for (const copy of copies) {
      entries.push({
        name: `${asciiFileName(copy.code, copy.scout.lastName, copy.scout.firstName)}.pdf`,
        data: await renderPaperDocument(copy, 'questionnaire'),
      });
    }
    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="questionnaires-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(createZip(entries));
  }

  @Post('corrections/:code/switch-to-paper')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Basculer une tentative en ligne non remise vers le papier (motif obligatoire)',
    description:
      'Annule la tentative en ligne (réponses conservées dans l’historique) et prépare une copie papier dans la même transaction. 409 OFFLINE_RESERVATION_PENDING pendant une réservation hors ligne non synchronisée.',
  })
  @ApiBody({ schema: openApiSchema(switchToPaperInputSchema, 'input') })
  @ApiOkResponse(detail)
  async switchToPaper(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Body() body: unknown,
  ): Promise<CorrectionDetail> {
    const attempt = await this.attempts.switchToPaper(actor, code, body);
    return this.attempts.detail(actor, { id: attempt.id });
  }

  @Get('corrections')
  @ApiOperation({ summary: 'Copies à corriger et historique des tentatives (chefs, responsable)' })
  @ApiQuery({ name: 'search', required: false, description: 'Code, nom, matricule ou titre' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'queue', required: false, enum: ['saisie', 'correction'] })
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
    summary: 'Copie par code (version exacte, réponses, historique)',
    description: 'Corrigé, barèmes et notes non publiées : responsable plein seulement (D161).',
  })
  @ApiOkResponse(detail)
  get(@CurrentActor() actor: Actor, @Param('code') code: string): Promise<CorrectionDetail> {
    return this.attempts.detail(actor, { code });
  }

  @Post('corrections/:code/answers')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enregistrer une saisie ou une correction (brouillon)',
    description:
      'Encadrement : transcription des réponses d’une copie papier non transmise (sans note). Responsable plein : notes des réponses libres et appréciations. Révision obligatoire ; motif si la copie était soumise.',
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

  @Post('corrections/:code/transmit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Transmettre une copie papier saisie pour correction (clôt la saisie)',
  })
  @ApiBody({ schema: openApiSchema(correctionRevisionInputSchema, 'input') })
  @ApiOkResponse(detail)
  transmit(
    @CurrentActor() actor: Actor,
    @Param('code') code: string,
    @Body() body: CorrectionRevisionInput,
  ): Promise<CorrectionDetail> {
    return this.attempts.transmit(actor, code, body);
  }

  @Post('corrections/:code/submit-review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valider le score final (responsable plein)' })
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
