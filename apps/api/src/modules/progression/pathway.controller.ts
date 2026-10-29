import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ActivateAgeRuleSetInput,
  activateAgeRuleSetInputSchema,
  type AgeRuleSet,
  type AgeRuleSetList,
  ageRuleSetListSchema,
  ageRuleSetSchema,
  type CatchUpObligation,
  catchUpObligationSchema,
  type CreateAgeRuleSetInput,
  createAgeRuleSetInputSchema,
  type DecideCatchUpInput,
  decideCatchUpInputSchema,
  type PathwayOverview,
  pathwayOverviewSchema,
  type ScoutPathway,
  scoutPathwaySchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { MembershipService, type MembershipRunReport } from './membership.service.js';
import { PathwayService } from './pathway.service.js';

@ApiTags('Parcours : âge, rattrapages, appartenance')
@ApiCookieAuth()
@Controller()
export class PathwayController {
  constructor(
    private readonly pathway: PathwayService,
    private readonly membership: MembershipService,
  ) {}

  @Get('age-rules')
  @ApiOperation({ summary: 'Référentiels d’âge (version en vigueur et historique)' })
  @ApiOkResponse({ schema: openApiSchema(ageRuleSetListSchema) })
  ruleSets(@CurrentActor() actor: Actor): Promise<AgeRuleSetList> {
    return this.pathway.ruleSets(actor);
  }

  @Post('age-rules')
  @ApiOperation({ summary: 'Créer un référentiel d’âge (brouillon, règles confirmées seulement)' })
  @ApiBody({ schema: openApiSchema(createAgeRuleSetInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(ageRuleSetSchema) })
  createRuleSet(
    @CurrentActor() actor: Actor,
    @Body() body: CreateAgeRuleSetInput,
  ): Promise<AgeRuleSet> {
    return this.pathway.createRuleSet(actor, body);
  }

  @Post('age-rules/:id/activate')
  @ApiOperation({ summary: 'Mettre en vigueur un référentiel (il devient immuable)' })
  @ApiBody({ schema: openApiSchema(activateAgeRuleSetInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(ageRuleSetSchema) })
  activate(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ActivateAgeRuleSetInput,
  ): Promise<AgeRuleSet> {
    return this.pathway.activateRuleSet(actor, parseId(id), body);
  }

  @Get('scouts/:id/pathway')
  @ApiOperation({
    summary: 'Parcours d’un routier : étape théorique, officielle, échéances, rattrapages',
  })
  @ApiOkResponse({ schema: openApiSchema(scoutPathwaySchema) })
  scoutPathway(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutPathway> {
    return this.pathway.pathway(actor, parseId(id));
  }

  @Get('statistics/pathways')
  @ApiOperation({ summary: 'Indicateurs de parcours : étapes théoriques, sorties, rattrapages' })
  @ApiOkResponse({ schema: openApiSchema(pathwayOverviewSchema) })
  pathwayOverview(
    @CurrentActor() actor: Actor,
    @Query('teamId') teamId?: string,
  ): Promise<PathwayOverview> {
    return this.pathway.overview(actor, teamId ? parseId(teamId) : undefined);
  }

  @Get('me/pathway')
  @ApiOperation({ summary: 'Mon parcours (routier connecté)' })
  @ApiOkResponse({ schema: openApiSchema(scoutPathwaySchema) })
  myPathway(@CurrentActor() actor: Actor): Promise<ScoutPathway> {
    return this.pathway.myPathway(actor);
  }

  @Post('catch-ups/:id/decision')
  @ApiOperation({ summary: 'Statuer sur une obligation de rattrapage (acquis ou non applicable)' })
  @ApiBody({ schema: openApiSchema(decideCatchUpInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(catchUpObligationSchema) })
  decide(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: DecideCatchUpInput,
  ): Promise<CatchUpObligation> {
    return this.pathway.decideCatchUp(actor, parseId(id), body);
  }

  @Post('membership/apply-exits')
  @ApiOperation({ summary: 'Appliquer les sorties de branche échues (idempotent)' })
  applyExits(@CurrentActor() actor: Actor): Promise<MembershipRunReport> {
    return this.membership.applyExitsAs(actor);
  }
}
