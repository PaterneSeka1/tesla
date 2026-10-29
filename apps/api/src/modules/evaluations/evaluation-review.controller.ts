import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ApproveModuleInput,
  approveModuleInputSchema,
  type EvaluationReview,
  evaluationReviewSchema,
  type EvaluationSubmissionItem,
  evaluationSubmissionListSchema,
  type EvaluationSubmissionQuery,
  type MotivatedDecisionInput,
  motivatedDecisionInputSchema,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationReviewService } from './evaluation-review.service.js';

/** Décisions sur les questionnaires : toutes les routes sont réservées au responsable pédagogique. */
@ApiTags('Approbation des évaluations')
@ApiCookieAuth()
@Controller('admin/evaluations')
export class EvaluationReviewController {
  constructor(private readonly review: EvaluationReviewService) {}

  @Get('submissions')
  @ApiOperation({ summary: 'Questionnaires soumis (ou approuvés à publier)' })
  @ApiQuery({ name: 'status', required: false, enum: ['SOUMIS', 'APPROUVE'] })
  @ApiOkResponse({ schema: openApiSchema(evaluationSubmissionListSchema) })
  async submissions(
    @CurrentActor() actor: Actor,
    @Query() query: EvaluationSubmissionQuery,
  ): Promise<{ items: EvaluationSubmissionItem[] }> {
    return { items: await this.review.submissions(actor, query) };
  }

  @Get(':id/review')
  @ApiOperation({ summary: 'Contenu exact soumis (corrigé compris), historique, version publiée' })
  @ApiOkResponse({ schema: openApiSchema(evaluationReviewSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<EvaluationReview> {
    return this.review.review(actor, parseId(id));
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approuver une version soumise' })
  @ApiBody({ schema: openApiSchema(approveModuleInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  approve(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ApproveModuleInput,
  ): Promise<void> {
    return this.review.approve(actor, parseId(id), body);
  }

  @Post(':id/request-changes')
  @ApiOperation({ summary: 'Demander des modifications (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(motivatedDecisionInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  requestChanges(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: MotivatedDecisionInput,
  ): Promise<void> {
    return this.review.requestChanges(actor, parseId(id), body);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Refuser une soumission (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(motivatedDecisionInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  reject(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: MotivatedDecisionInput,
  ): Promise<void> {
    return this.review.reject(actor, parseId(id), body);
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: 'Publier une version approuvée',
    description:
      'Atomique : la version publiée précédente est archivée. Le module évalué doit être publié.',
  })
  @ApiBody({ schema: openApiSchema(versionActionInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  publish(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: VersionActionInput,
  ): Promise<void> {
    return this.review.publish(actor, parseId(id), body);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archiver la version publiée (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(motivatedDecisionInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  archive(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: MotivatedDecisionInput,
  ): Promise<void> {
    return this.review.archive(actor, parseId(id), body);
  }
}
