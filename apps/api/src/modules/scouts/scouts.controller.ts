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
  assignTeamBodySchema,
  createScoutProfileInputSchema,
  linkAccountInputSchema,
  type Paginated,
  paginatedSchema,
  type ScoutDetail,
  scoutDetailSchema,
  type ScoutListItem,
  scoutListItemSchema,
  type ScoutListQuery,
  type ScoutPedagogicalHistory,
  scoutPedagogicalHistorySchema,
  type TeamAssignmentList,
  teamAssignmentListSchema,
  unassignTeamBodySchema,
  updateScoutProfileInputSchema,
  type CreateScoutProfileInput,
  type LinkAccountInput,
  type UpdateScoutProfileInput,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId, parseInput } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ScoutProfilesService } from './scout-profiles.service.js';
import { TeamsService } from './teams.service.js';

@ApiTags('Routiers')
@ApiCookieAuth()
@Controller('scouts')
export class ScoutsController {
  constructor(
    private readonly profiles: ScoutProfilesService,
    private readonly teams: TeamsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Rechercher les routiers (nom, prénoms, matricule) et filtrer' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'teamId', required: false, description: 'UUID ou « none »' })
  @ApiQuery({ name: 'stageId', required: false, description: 'UUID ou « none »' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'all'] })
  @ApiQuery({ name: 'account', required: false, enum: ['with', 'without', 'all'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(scoutListItemSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: ScoutListQuery,
  ): Promise<Paginated<ScoutListItem>> {
    return this.profiles.list(actor, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Inscrire un routier sans compte (responsable)',
    description: '409 POSSIBLE_DUPLICATE si un homonyme existe : renvoyer avec confirmDuplicate.',
  })
  @ApiBody({ schema: openApiSchema(createScoutProfileInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(scoutDetailSchema) })
  async create(
    @CurrentActor() actor: Actor,
    @Body() body: CreateScoutProfileInput,
  ): Promise<ScoutDetail> {
    const profile = await this.profiles.create(actor, body);
    return this.profiles.get(actor, profile.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche d’un routier' })
  @ApiOkResponse({ schema: openApiSchema(scoutDetailSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutDetail> {
    return this.profiles.get(actor, parseId(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une fiche (responsable)',
    description: 'Le changement d’étape est journalisé et réservé au responsable.',
  })
  @ApiBody({ schema: openApiSchema(updateScoutProfileInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(scoutDetailSchema) })
  async update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateScoutProfileInput,
  ): Promise<ScoutDetail> {
    const profile = await this.profiles.update(actor, parseId(id), body);
    return this.profiles.get(actor, profile.id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Désactiver un profil (clôt l’affectation d’équipe en cours)' })
  @ApiCreatedResponse({ schema: openApiSchema(scoutDetailSchema) })
  async deactivate(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutDetail> {
    const profile = await this.profiles.setActive(actor, parseId(id), false);
    return this.profiles.get(actor, profile.id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Réactiver un profil' })
  @ApiCreatedResponse({ schema: openApiSchema(scoutDetailSchema) })
  async activate(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutDetail> {
    const profile = await this.profiles.setActive(actor, parseId(id), true);
    return this.profiles.get(actor, profile.id);
  }

  @Post(':id/link-account')
  @ApiOperation({
    summary: 'Rattacher un compte routier existant (responsable)',
    description: 'Le profil et son historique sont conservés ; aucun second profil n’est créé.',
  })
  @ApiBody({ schema: openApiSchema(linkAccountInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(scoutDetailSchema) })
  async linkAccount(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: LinkAccountInput,
  ): Promise<ScoutDetail> {
    const profile = await this.profiles.linkAccountByEmail(actor, parseId(id), body);
    return this.profiles.get(actor, profile.id);
  }

  @Get(':id/teams/history')
  @ApiOperation({ summary: 'Historique des équipes' })
  @ApiOkResponse({ schema: openApiSchema(teamAssignmentListSchema) })
  async teamHistory(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<TeamAssignmentList> {
    return { items: await this.teams.history(actor, parseId(id)) };
  }

  @Post(':id/teams/assign')
  @ApiOperation({
    summary: 'Affecter ou changer d’équipe (responsable)',
    description: 'Transaction : clôture de l’affectation précédente puis nouvelle affectation.',
  })
  @ApiBody({ schema: openApiSchema(assignTeamBodySchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(teamAssignmentListSchema) })
  async assign(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TeamAssignmentList> {
    const scoutProfileId = parseId(id);
    const data = parseInput(assignTeamBodySchema, body);
    await this.teams.assign(actor, { ...data, scoutProfileId });
    return { items: await this.teams.history(actor, scoutProfileId) };
  }

  @Post(':id/teams/unassign')
  @ApiOperation({ summary: 'Retirer le routier de son équipe (responsable)' })
  @ApiBody({ schema: openApiSchema(unassignTeamBodySchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(teamAssignmentListSchema) })
  async unassign(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TeamAssignmentList> {
    const scoutProfileId = parseId(id);
    const { endedAt } = parseInput(unassignTeamBodySchema, body ?? {});
    await this.teams.unassign(actor, scoutProfileId, endedAt ? new Date(endedAt) : undefined);
    return { items: await this.teams.history(actor, scoutProfileId) };
  }

  @Get(':id/pedagogical-history')
  @ApiOperation({ summary: 'Historique pédagogique enregistré (tentatives, changements d’étape)' })
  @ApiOkResponse({ schema: openApiSchema(scoutPedagogicalHistorySchema) })
  pedagogicalHistory(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<ScoutPedagogicalHistory> {
    return this.profiles.pedagogicalHistory(actor, parseId(id));
  }
}
