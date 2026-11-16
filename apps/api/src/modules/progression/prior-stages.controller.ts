import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type PriorStageList,
  priorStageListSchema,
  type PriorStageRecognition,
  priorStageRecognitionSchema,
  type RecognizePriorStageInput,
  recognizePriorStageInputSchema,
  type RevokePriorStageInput,
  revokePriorStageInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { PriorStagesService } from './prior-stages.service.js';

/** Parcours antérieur reconnu (D181) : lecture par l'encadrement, décisions par le plein. */
@ApiTags('Parcours : parcours antérieur reconnu')
@ApiCookieAuth()
@Controller()
export class PriorStagesController {
  constructor(private readonly priorStages: PriorStagesService) {}

  @Get('scouts/:id/prior-stages')
  @ApiOperation({ summary: 'Étapes reconnues au titre du parcours antérieur (historique complet)' })
  @ApiOkResponse({ schema: openApiSchema(priorStageListSchema) })
  list(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<PriorStageList> {
    return this.priorStages.list(actor, parseId(id));
  }

  @Post('scouts/:id/prior-stages')
  @ApiOperation({ summary: 'Reconnaître une étape accomplie avant l’arrivée sur la plateforme' })
  @ApiBody({ schema: openApiSchema(recognizePriorStageInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(priorStageRecognitionSchema) })
  recognize(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: RecognizePriorStageInput,
  ): Promise<PriorStageRecognition> {
    return this.priorStages.recognize(actor, parseId(id), body);
  }

  @Post('prior-stages/:id/revoke')
  @ApiOperation({ summary: 'Révoquer une reconnaissance enregistrée par erreur (motif requis)' })
  @ApiBody({ schema: openApiSchema(revokePriorStageInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(priorStageRecognitionSchema) })
  revoke(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: RevokePriorStageInput,
  ): Promise<PriorStageRecognition> {
    return this.priorStages.revoke(actor, parseId(id), body);
  }
}
