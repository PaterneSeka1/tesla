import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateDelegationInput,
  createDelegationInputSchema,
  type CreateScoutYearInput,
  createScoutYearInputSchema,
  type Delegation,
  delegationSchema,
  type EndMandateInput,
  endMandateInputSchema,
  type LeadershipOverview,
  leadershipOverviewSchema,
  type Mandate,
  type MandateHistory,
  mandateHistorySchema,
  mandateSchema,
  type ReconductionDraft,
  reconductionDraftSchema,
  type RecordMandateInput,
  recordMandateInputSchema,
  type RevokeDelegationInput,
  revokeDelegationInputSchema,
  type ScoutYear,
  scoutYearSchema,
} from '@tesla/shared';
import { z } from 'zod';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { LeadershipService } from './leadership.service.js';

@ApiTags('Encadrement : mandats et délégations')
@ApiCookieAuth()
@Controller()
export class LeadershipController {
  constructor(private readonly leadership: LeadershipService) {}

  @Get('leadership')
  @ApiOperation({ summary: 'Encadrement en exercice, vacances, comptes sans mandat, délégations' })
  @ApiOkResponse({ schema: openApiSchema(leadershipOverviewSchema) })
  overview(@CurrentActor() actor: Actor): Promise<LeadershipOverview> {
    return this.leadership.overview(actor);
  }

  @Get('mandates')
  @ApiOperation({ summary: 'Historique des mandats (filtres : année scoute, personne)' })
  @ApiOkResponse({ schema: openApiSchema(mandateHistorySchema) })
  history(
    @CurrentActor() actor: Actor,
    @Query('scoutYearId') scoutYearId?: string,
    @Query('userId') userId?: string,
  ): Promise<MandateHistory> {
    return this.leadership.history(actor, {
      scoutYearId: scoutYearId ? parseId(scoutYearId) : undefined,
      userId: userId ? parseId(userId) : undefined,
    });
  }

  @Post('mandates')
  @ApiOperation({
    summary: 'Consigner une nomination, reconduction, un remplacement ou un changement de fonction',
    description:
      'Plein : administration technique (l’autorité de nomination est référencée). Adjoint et assistants : responsable plein en exercice ou administration technique.',
  })
  @ApiBody({ schema: openApiSchema(recordMandateInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(mandateSchema) })
  record(@CurrentActor() actor: Actor, @Body() body: RecordMandateInput): Promise<Mandate> {
    return this.leadership.record(actor, body);
  }

  @Post('mandates/:id/end')
  @ApiOperation({ summary: 'Enregistrer une fin anticipée de mandat' })
  @ApiBody({ schema: openApiSchema(endMandateInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(mandateSchema) })
  end(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: EndMandateInput,
  ): Promise<Mandate> {
    return this.leadership.end(actor, parseId(id), body);
  }

  @Get('mandates/:id/reconduction')
  @ApiOperation({
    summary: 'Préremplir la reconduction pour l’année suivante (rien n’est enregistré)',
  })
  @ApiOkResponse({ schema: openApiSchema(reconductionDraftSchema) })
  reconduction(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ReconductionDraft> {
    return this.leadership.reconductionDraft(actor, parseId(id));
  }

  @Post('scout-years')
  @ApiOperation({ summary: 'Déclarer une année scoute (calendrier configurable)' })
  @ApiBody({ schema: openApiSchema(createScoutYearInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(scoutYearSchema) })
  createScoutYear(
    @CurrentActor() actor: Actor,
    @Body() body: CreateScoutYearInput,
  ): Promise<ScoutYear> {
    return this.leadership.createScoutYear(actor, body);
  }

  @Get('delegations')
  @ApiOperation({ summary: 'Délégations (actives, à venir, échues, révoquées)' })
  @ApiOkResponse({ schema: openApiSchema(z.array(delegationSchema)) })
  delegations(@CurrentActor() actor: Actor): Promise<Delegation[]> {
    return this.leadership.listDelegations(actor);
  }

  @Post('delegations')
  @ApiOperation({ summary: 'Déléguer des permissions officielles (responsable plein)' })
  @ApiBody({ schema: openApiSchema(createDelegationInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(delegationSchema) })
  delegate(@CurrentActor() actor: Actor, @Body() body: CreateDelegationInput): Promise<Delegation> {
    return this.leadership.delegate(actor, body);
  }

  @Post('delegations/:id/revoke')
  @ApiOperation({ summary: 'Révoquer une délégation' })
  @ApiBody({ schema: openApiSchema(revokeDelegationInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(delegationSchema) })
  revoke(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: RevokeDelegationInput,
  ): Promise<Delegation> {
    return this.leadership.revokeDelegation(actor, parseId(id), body);
  }
}
