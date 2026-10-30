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
  type ModuleReview,
  moduleReviewSchema,
  type MotivatedDecisionInput,
  motivatedDecisionInputSchema,
  type Paginated,
  paginatedSchema,
  type PaginationQuery,
  type PublicationHistoryItem,
  publicationHistoryItemSchema,
  type SubmissionItem,
  submissionListSchema,
  type SubmissionListQuery,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ModuleReviewService } from './module-review.service.js';

/** Décisions éditoriales : toutes les routes sont réservées au responsable pédagogique. */
@ApiTags('Approbation des modules')
@ApiCookieAuth()
@Controller('admin/modules')
export class ModuleReviewController {
  constructor(private readonly review: ModuleReviewService) {}

  @Get('submissions')
  @ApiOperation({ summary: 'File de validation : versions soumises (ou approuvées à publier)' })
  @ApiQuery({ name: 'status', required: false, enum: ['SOUMIS', 'APPROUVE'] })
  @ApiOkResponse({ schema: openApiSchema(submissionListSchema) })
  async submissions(
    @CurrentActor() actor: Actor,
    @Query() query: SubmissionListQuery,
  ): Promise<{ items: SubmissionItem[] }> {
    return { items: await this.review.submissions(actor, query) };
  }

  @Get('history')
  @ApiOperation({ summary: 'Historique des décisions de publication' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(publicationHistoryItemSchema)) })
  history(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationQuery,
  ): Promise<Paginated<PublicationHistoryItem>> {
    return this.review.history(actor, query);
  }

  @Get(':id/review')
  @ApiOperation({ summary: 'Contenu exact soumis, historique et version publiée actuelle' })
  @ApiOkResponse({ schema: openApiSchema(moduleReviewSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ModuleReview> {
    return this.review.review(actor, parseId(id));
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approuver une version soumise (commentaire facultatif)' })
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
  @ApiOperation({ summary: 'Demander des corrections (motif obligatoire)' })
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
    description: 'Atomique : la version publiée précédente est archivée dans la même transaction.',
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

  @Post(':id/purge')
  @ApiOperation({
    summary:
      'Supprimer définitivement un brouillon vide (jamais soumis ni publié ; motif obligatoire)',
  })
  @ApiBody({ schema: openApiSchema(motivatedDecisionInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  purge(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: MotivatedDecisionInput,
  ): Promise<void> {
    return this.review.purgeEmptyDraft(actor, parseId(id), body);
  }
}
