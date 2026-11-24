import { Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  learningJournalSchema,
  lessonReadInputSchema,
  type LearningJournal,
  type PracticeBank,
  practiceBankSchema,
  type PracticeInsights,
  practiceInsightsSchema,
  type PracticeResult,
  practiceResultInputSchema,
  practiceResultSchema,
  type RewardSummary,
  rewardSummarySchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { PracticeService } from './practice.service.js';

/** Entraînement libre (banque des modules publiés) et progression ludique du compte connecté. */
@ApiTags('Entraînement')
@ApiCookieAuth()
@Controller()
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Get('practice/bank')
  @ApiOperation({ summary: 'Activités d’entraînement des modules publiés' })
  @ApiOkResponse({ schema: openApiSchema(practiceBankSchema) })
  bank(@CurrentActor() actor: Actor): Promise<PracticeBank> {
    return this.practice.bank(actor);
  }

  @Get('practice/insights')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Activités les plus difficiles (agrégé, encadrement)' })
  @ApiOkResponse({ schema: openApiSchema(practiceInsightsSchema) })
  insights(@CurrentActor() actor: Actor): Promise<PracticeInsights> {
    return this.practice.insights(actor);
  }

  @Post('me/practice/results')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enregistrer un entraînement (recorrigé par le serveur)' })
  @ApiBody({ schema: openApiSchema(practiceResultInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(practiceResultSchema) })
  result(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<PracticeResult> {
    return this.practice.recordResult(actor, body);
  }

  @Post('me/lessons/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Signaler une leçon lue jusqu’au bout' })
  @ApiBody({ schema: openApiSchema(lessonReadInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(rewardSummarySchema) })
  lessonRead(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<RewardSummary> {
    return this.practice.recordLessonRead(actor, body);
  }

  @Get('me/journal')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Carnet d’aventure : XP, badges, révisions du jour' })
  @ApiOkResponse({ schema: openApiSchema(learningJournalSchema) })
  journal(@CurrentActor() actor: Actor): Promise<LearningJournal> {
    return this.practice.journal(actor);
  }
}
