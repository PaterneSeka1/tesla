import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type OfflineSyncInput,
  offlineEvaluationPackageSchema,
  offlineStatusSchema,
  offlineSyncInputSchema,
} from '@tesla/shared';
import { z } from 'zod';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { OfflineService } from './offline.service.js';

@ApiTags('Hors ligne')
@ApiCookieAuth()
@Controller()
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}

  @Post('offline/evaluations/:id/prepare')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Réserver une tentative hors ligne pour 24 heures (droits revérifiés à réception)',
  })
  @ApiOkResponse({ schema: openApiSchema(offlineEvaluationPackageSchema) })
  prepare(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.offline.prepare(actor, parseId(id));
  }

  @Get('offline/attempts/:id/status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'État officiel de la tentative hors ligne personnelle' })
  @ApiOkResponse({ schema: openApiSchema(offlineStatusSchema) })
  status(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.offline.status(actor, parseId(id));
  }

  @Post('offline/attempts/:id/sync')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Remettre une copie hors ligne de façon transactionnelle et idempotente',
  })
  @ApiBody({ schema: openApiSchema(offlineSyncInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(offlineStatusSchema) })
  sync(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() input: OfflineSyncInput) {
    return this.offline.sync(actor, parseId(id), input);
  }

  @Get('me/offline-sync/status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cent dernières réservations hors ligne du compte' })
  @ApiOkResponse({ schema: openApiSchema(z.array(offlineStatusSchema)) })
  summary(@CurrentActor() actor: Actor) {
    return this.offline.summary(actor);
  }
}
