import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AssignLeaderInput,
  assignLeaderInputSchema,
  type EndLeaderInput,
  endLeaderInputSchema,
  type LeadershipAdmin,
  leadershipAdminSchema,
  type LeadershipAssignment,
  leadershipAssignmentSchema,
  type LeadershipTeam,
  leadershipTeamSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { LeadershipService } from './leadership.service.js';

@ApiTags('Encadrement')
@ApiCookieAuth()
@Controller('leadership')
export class LeadershipController {
  constructor(private readonly leadership: LeadershipService) {}

  @Get()
  @ApiOperation({ summary: 'Encadrement en fonction (responsable plein, adjoint, assistants)' })
  @ApiOkResponse({ schema: openApiSchema(leadershipTeamSchema) })
  team(@CurrentActor() actor: Actor): Promise<LeadershipTeam> {
    return this.leadership.team(actor);
  }

  @Get('admin')
  @ApiOperation({ summary: 'Administration : composition, personnes désignables, historique' })
  @ApiOkResponse({ schema: openApiSchema(leadershipAdminSchema) })
  admin(@CurrentActor() actor: Actor): Promise<LeadershipAdmin> {
    return this.leadership.admin(actor);
  }

  @Post('assignments')
  @ApiOperation({
    summary: 'Désigner une personne à une fonction (remplacement du plein confirmé)',
    description: 'Administrateur uniquement. Transactionnel et journalisé.',
  })
  @ApiBody({ schema: openApiSchema(assignLeaderInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(leadershipAssignmentSchema) })
  assign(
    @CurrentActor() actor: Actor,
    @Body() body: AssignLeaderInput,
  ): Promise<LeadershipAssignment> {
    return this.leadership.assign(actor, body);
  }

  @Post('assignments/:id/end')
  @ApiOperation({ summary: 'Mettre fin à une fonction' })
  @ApiBody({ schema: openApiSchema(endLeaderInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(leadershipAssignmentSchema) })
  end(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: EndLeaderInput,
  ): Promise<LeadershipAssignment> {
    return this.leadership.end(actor, parseId(id), body);
  }
}
