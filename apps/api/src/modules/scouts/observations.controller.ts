import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  createObservationInputSchema,
  type Observation,
  observationRevisionListSchema,
  type ObservationRevision,
  observationSchema,
  type Paginated,
  paginatedSchema,
  type PaginationQuery,
  updateObservationInputSchema,
  type CreateObservationInput,
  type UpdateObservationInput,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ObservationsService } from './observations.service.js';

@ApiTags('Observations')
@ApiCookieAuth()
@Controller('scouts/:id/observations')
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Observations visibles par l’utilisateur (chefs, responsable)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(observationSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Query() query: Partial<PaginationQuery>,
  ): Promise<Paginated<Observation>> {
    return this.observations.list(actor, parseId(id), query);
  }

  @Post()
  @ApiOperation({
    summary: 'Saisir une observation',
    description: 'Information d’accompagnement : ne vaut jamais validation officielle.',
  })
  @ApiBody({ schema: openApiSchema(createObservationInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(observationSchema) })
  create(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateObservationInput,
  ): Promise<Observation> {
    return this.observations.create(actor, parseId(id), body);
  }

  @Patch(':observationId')
  @ApiOperation({ summary: 'Modifier sa propre observation (version précédente conservée)' })
  @ApiBody({ schema: openApiSchema(updateObservationInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(observationSchema) })
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('observationId') observationId: string,
    @Body() body: UpdateObservationInput,
  ): Promise<Observation> {
    return this.observations.update(actor, parseId(id), parseId(observationId), body);
  }

  @Get(':observationId/revisions')
  @ApiOperation({ summary: 'Historique des modifications d’une observation' })
  @ApiOkResponse({ schema: openApiSchema(observationRevisionListSchema) })
  async revisions(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('observationId') observationId: string,
  ): Promise<{ items: ObservationRevision[] }> {
    return { items: await this.observations.revisions(actor, parseId(id), parseId(observationId)) };
  }
}
