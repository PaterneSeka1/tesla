import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AttemptReasonInput,
  attemptReasonInputSchema,
  type GrantWaiverInput,
  grantWaiverInputSchema,
  type Paginated,
  paginatedSchema,
  type Waiver,
  type WaiverListQuery,
  waiverSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationWaiversService } from './evaluation-waivers.service.js';

/** Déblocages individuels : responsable uniquement, motivés, datés, révocables, journalisés. */
@ApiTags('Déblocages d’évaluation')
@ApiCookieAuth()
@Controller('admin/waivers')
export class EvaluationWaiversController {
  constructor(private readonly waivers: EvaluationWaiversService) {}

  @Get()
  @ApiOperation({ summary: 'Dérogations (actives, inactives ou toutes)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'all'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(waiverSchema)) })
  list(@CurrentActor() actor: Actor, @Query() query: WaiverListQuery): Promise<Paginated<Waiver>> {
    return this.waivers.list(actor, query);
  }

  @Post()
  @ApiOperation({ summary: 'Accorder une dérogation (motif obligatoire, expiration facultative)' })
  @ApiBody({ schema: openApiSchema(grantWaiverInputSchema, 'input') })
  @ApiCreatedResponse({ description: 'Dérogation créée' })
  async grant(
    @CurrentActor() actor: Actor,
    @Body() body: GrantWaiverInput,
  ): Promise<{ id: string }> {
    const waiver = await this.waivers.grant(actor, body);
    return { id: waiver.id };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Révoquer une dérogation (motif obligatoire)' })
  @ApiBody({ schema: openApiSchema(attemptReasonInputSchema, 'input') })
  @ApiOkResponse({ description: 'Dérogation révoquée' })
  async revoke(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: AttemptReasonInput,
  ): Promise<{ id: string }> {
    const waiver = await this.waivers.revoke(actor, parseId(id), body);
    return { id: waiver.id };
  }
}
