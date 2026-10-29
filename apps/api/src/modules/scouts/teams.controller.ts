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
  createTeamInputSchema,
  type Paginated,
  paginatedSchema,
  type Team,
  type TeamDetail,
  teamDetailSchema,
  type TeamListQuery,
  teamSchema,
  type UpdateTeamInput,
  updateTeamInputSchema,
  type CreateTeamInput,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { TeamsService } from './teams.service.js';

@ApiTags('Équipes')
@ApiCookieAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister et rechercher les équipes (chefs, responsable)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'archived', 'all'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(teamSchema)) })
  list(@CurrentActor() actor: Actor, @Query() query: TeamListQuery): Promise<Paginated<Team>> {
    return this.teams.list(actor, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une équipe (responsable)' })
  @ApiBody({ schema: openApiSchema(createTeamInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(teamDetailSchema) })
  async create(@CurrentActor() actor: Actor, @Body() body: CreateTeamInput): Promise<TeamDetail> {
    const team = await this.teams.create(actor, body);
    return this.teams.get(actor, team.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Équipe et membres actuels' })
  @ApiOkResponse({ schema: openApiSchema(teamDetailSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<TeamDetail> {
    return this.teams.get(actor, parseId(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier le nom ou la description (responsable)' })
  @ApiBody({ schema: openApiSchema(updateTeamInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(teamDetailSchema) })
  async update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateTeamInput,
  ): Promise<TeamDetail> {
    const team = await this.teams.update(actor, parseId(id), body);
    return this.teams.get(actor, team.id);
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archiver une équipe (responsable)',
    description: 'Clôt les affectations ouvertes ; aucun historique n’est supprimé.',
  })
  @ApiCreatedResponse({ schema: openApiSchema(teamDetailSchema) })
  async archive(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<TeamDetail> {
    const { team } = await this.teams.archive(actor, parseId(id));
    return this.teams.get(actor, team.id);
  }
}
