import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateStageOverrideInput,
  createStageOverrideInputSchema,
  type LiftStageOverrideInput,
  liftStageOverrideInputSchema,
  type PreviewStageOverrideInput,
  previewStageOverrideInputSchema,
  type StageOverride,
  type StageOverridePreview,
  stageOverridePreviewSchema,
  stageOverrideSchema,
  type StageSupervision,
  stageSupervisionSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { StageOverridesService } from './stage-overrides.service.js';

/** Supervision de la progression et correction exceptionnelle de l'étape : plein en fonction (D176). */
@ApiTags('Parcours : supervision et exception de secours')
@ApiCookieAuth()
@Controller()
export class StageOverridesController {
  constructor(private readonly overrides: StageOverridesService) {}

  @Get('scouts/:id/stage-supervision')
  @ApiOperation({ summary: 'Règles, périodes, étape normale et appliquée, exceptions (plein)' })
  @ApiOkResponse({ schema: openApiSchema(stageSupervisionSchema) })
  supervision(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<StageSupervision> {
    return this.overrides.supervision(actor, parseId(id));
  }

  @Post('scouts/:id/stage-overrides/preview')
  @ApiOperation({ summary: 'Conséquences d’une correction exceptionnelle (sans écriture)' })
  @ApiBody({ schema: openApiSchema(previewStageOverrideInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(stageOverridePreviewSchema) })
  preview(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: PreviewStageOverrideInput,
  ): Promise<StageOverridePreview> {
    return this.overrides.preview(actor, parseId(id), body);
  }

  @Post('scouts/:id/stage-overrides')
  @ApiOperation({ summary: 'Appliquer une correction exceptionnelle et temporaire de l’étape' })
  @ApiBody({ schema: openApiSchema(createStageOverrideInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(stageOverrideSchema) })
  create(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateStageOverrideInput,
  ): Promise<StageOverride> {
    return this.overrides.create(actor, parseId(id), body);
  }

  @Post('stage-overrides/:id/lift')
  @ApiOperation({ summary: 'Lever une exception (retour immédiat à l’étape normale)' })
  @ApiBody({ schema: openApiSchema(liftStageOverrideInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(stageOverrideSchema) })
  lift(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: LiftStageOverrideInput,
  ): Promise<StageOverride> {
    return this.overrides.lift(actor, parseId(id), body);
  }
}
