import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AttemptSession,
  attemptSessionSchema,
  type AvailableEvaluation,
  type AvailableEvaluationQuery,
  availableEvaluationSchema,
  type MyAttempt,
  type MyAttemptQuery,
  myAttemptSchema,
  type Paginated,
  paginatedSchema,
  type SaveAnswersInput,
  saveAnswersInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationSessionsService } from './evaluation-sessions.service.js';

const session = { schema: openApiSchema(attemptSessionSchema) };

/** Évaluations publiées et passation en ligne. Aucune réponse ne contient de corrigé ni de barème. */
@ApiTags('Évaluations des routiers')
@ApiCookieAuth()
@Controller()
export class EvaluationSessionsController {
  constructor(private readonly sessions: EvaluationSessionsService) {}

  @Get('evaluations')
  @ApiOperation({
    summary: 'Évaluations publiées et éligibilité',
    description:
      'Routier : son éligibilité. Chef ou responsable : éligibilité du routier `scoutProfileId` (préparation papier).',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'stageId', required: false })
  @ApiQuery({ name: 'scoutProfileId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(availableEvaluationSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: AvailableEvaluationQuery,
  ): Promise<Paginated<AvailableEvaluation>> {
    return this.sessions.list(actor, query);
  }

  @Get('evaluations/:id')
  @ApiOperation({
    summary: 'Présentation d’une évaluation publiée (consignes, nombre de questions)',
  })
  @ApiOkResponse({ schema: openApiSchema(availableEvaluationSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AvailableEvaluation> {
    return this.sessions.detail(actor, parseId(id));
  }

  @Post('evaluations/:id/attempts')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Démarrer ou reprendre une tentative en ligne',
    description:
      'Éligibilité contrôlée côté serveur ; idempotent (une tentative ouverte est reprise).',
  })
  @ApiOkResponse(session)
  start(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AttemptSession> {
    return this.sessions.start(actor, parseId(id));
  }

  @Get('attempts/:id')
  @ApiOperation({ summary: 'Questionnaire et réponses enregistrées de ma tentative en ligne' })
  @ApiOkResponse(session)
  session(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AttemptSession> {
    return this.sessions.session(actor, parseId(id));
  }

  @Post('attempts/:id/answers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enregistrer mes réponses en cours' })
  @ApiBody({ schema: openApiSchema(saveAnswersInputSchema, 'input') })
  @ApiOkResponse(session)
  saveAnswers(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SaveAnswersInput,
  ): Promise<AttemptSession> {
    return this.sessions.saveAnswers(actor, parseId(id), body);
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remettre mes réponses (définitif)',
    description: 'Correction automatique des questions objectives ; 409 si déjà remises.',
  })
  @ApiBody({ schema: openApiSchema(saveAnswersInputSchema, 'input'), required: false })
  @ApiOkResponse(session)
  submit(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SaveAnswersInput,
  ): Promise<AttemptSession> {
    return this.sessions.submit(actor, parseId(id), body);
  }

  @Get('me/attempts')
  @ApiOperation({ summary: 'Mon historique de tentatives (résultat après examen du responsable)' })
  @ApiQuery({ name: 'evaluationId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(myAttemptSchema)) })
  myAttempts(
    @CurrentActor() actor: Actor,
    @Query() query: MyAttemptQuery,
  ): Promise<Paginated<MyAttempt>> {
    return this.sessions.myAttempts(actor, query);
  }
}
