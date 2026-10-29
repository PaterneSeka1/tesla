import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type ChefDashboard,
  chefDashboardSchema,
  type MyActivities,
  myActivitiesSchema,
  type MyDashboard,
  myDashboardSchema,
  type ResponsableDashboard,
  responsableDashboardSchema,
  type Statistics,
  type StatisticsQuery,
  statisticsSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { DashboardsService } from './dashboards.service.js';

@ApiTags('Tableaux de bord')
@ApiCookieAuth()
@Controller()
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Indicateurs réels par équipe et par étape (encadrement)' })
  @ApiQuery({ name: 'from', required: false, description: 'AAAA-MM-JJ' })
  @ApiQuery({ name: 'to', required: false, description: 'AAAA-MM-JJ' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'stageId', required: false })
  @ApiOkResponse({ schema: openApiSchema(statisticsSchema) })
  statistics(@CurrentActor() actor: Actor, @Query() query: StatisticsQuery): Promise<Statistics> {
    return this.dashboards.statistics(actor, query);
  }

  @Get('dashboard/responsable')
  @ApiOperation({
    summary: 'Tableau de bord du responsable',
    description:
      'Deux files distinctes : contenus à approuver ; décisions pédagogiques sur les personnes.',
  })
  @ApiOkResponse({ schema: openApiSchema(responsableDashboardSchema) })
  responsable(@CurrentActor() actor: Actor): Promise<ResponsableDashboard> {
    return this.dashboards.responsable(actor);
  }

  @Get('dashboard/chef')
  @ApiOperation({ summary: 'Tableau de bord d’un chef' })
  @ApiOkResponse({ schema: openApiSchema(chefDashboardSchema) })
  chef(@CurrentActor() actor: Actor): Promise<ChefDashboard> {
    return this.dashboards.chef(actor);
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Tableau de bord du routier connecté (sans classement)' })
  @ApiOkResponse({ schema: openApiSchema(myDashboardSchema) })
  me(@CurrentActor() actor: Actor): Promise<MyDashboard> {
    return this.dashboards.me(actor);
  }

  @Get('me/activities')
  @ApiOperation({ summary: 'Mes activités : à venir (selon mon étape) et présences enregistrées' })
  @ApiOkResponse({ schema: openApiSchema(myActivitiesSchema) })
  myActivities(@CurrentActor() actor: Actor): Promise<MyActivities> {
    return this.dashboards.myActivities(actor);
  }
}
