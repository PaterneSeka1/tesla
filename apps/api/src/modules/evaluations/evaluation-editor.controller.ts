import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  type CreateEvaluationInput,
  createEvaluationInputSchema,
  type CreateQuestionInput,
  createQuestionInputSchema,
  deleteQuestionQuerySchema,
  type EditorEvaluationDetail,
  editorEvaluationDetailSchema,
  type EditorEvaluationListItem,
  editorEvaluationListItemSchema,
  type EditorEvaluationListQuery,
  type EvaluationModuleRef,
  moduleOptionListSchema,
  type Paginated,
  paginatedSchema,
  type ReorderQuestionsInput,
  reorderQuestionsInputSchema,
  type SubmitEvaluationInput,
  submitEvaluationInputSchema,
  type UpdateEvaluationInput,
  updateEvaluationInputSchema,
  type UpdateQuestionInput,
  updateQuestionInputSchema,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId, parseInput } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationEditorService } from './evaluation-editor.service.js';

const detail = { schema: openApiSchema(editorEvaluationDetailSchema) };

/**
 * Rédaction des questionnaires (chefs, responsable). Corrigés et barèmes inclus dans les réponses :
 * routes refusées aux routiers. Aucune route de ce contrôleur ne publie une évaluation.
 */
@ApiTags('Rédaction des évaluations')
@ApiCookieAuth()
@Controller('editor/evaluations')
export class EvaluationEditorController {
  constructor(private readonly editor: EvaluationEditorService) {}

  @Get()
  @ApiOperation({
    summary: 'Questionnaires sur lesquels je peux intervenir (tous pour le responsable)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(editorEvaluationListItemSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: EditorEvaluationListQuery,
  ): Promise<Paginated<EditorEvaluationListItem>> {
    return this.editor.list(actor, query);
  }

  @Get('module-options')
  @ApiOperation({ summary: 'Modules proposés au rattachement d’une évaluation' })
  @ApiOkResponse({ schema: openApiSchema(moduleOptionListSchema) })
  async moduleOptions(@CurrentActor() actor: Actor): Promise<{ items: EvaluationModuleRef[] }> {
    return { items: await this.editor.moduleOptions(actor) };
  }

  @Post()
  @ApiOperation({ summary: 'Créer un questionnaire (version 1 en brouillon)' })
  @ApiBody({ schema: openApiSchema(createEvaluationInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  create(
    @CurrentActor() actor: Actor,
    @Body() body: CreateEvaluationInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.create(actor, body);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Questionnaire : version de travail (corrigé compris), versions, historique',
  })
  @ApiOkResponse(detail)
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<EditorEvaluationDetail> {
    return this.editor.detail(actor, parseId(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier les informations du brouillon (révision obligatoire)' })
  @ApiBody({ schema: openApiSchema(updateEvaluationInputSchema, 'input') })
  @ApiOkResponse(detail)
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateEvaluationInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.update(actor, parseId(id), body);
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Ajouter une question (propositions, bonnes réponses, barème)' })
  @ApiBody({ schema: openApiSchema(createQuestionInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  addQuestion(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateQuestionInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.addQuestion(actor, parseId(id), body);
  }

  @Patch(':id/questions/:questionId')
  @ApiOperation({ summary: 'Remplacer une question et ses propositions (révision obligatoire)' })
  @ApiBody({ schema: openApiSchema(updateQuestionInputSchema, 'input') })
  @ApiOkResponse(detail)
  updateQuestion(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: UpdateQuestionInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.updateQuestion(actor, parseId(id), parseId(questionId), body);
  }

  @Delete(':id/questions/:questionId')
  @ApiOperation({ summary: 'Supprimer une question du brouillon' })
  @ApiQuery({ name: 'revision', required: true })
  @ApiOkResponse(detail)
  deleteQuestion(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Query() query: unknown,
  ): Promise<EditorEvaluationDetail> {
    const { revision } = parseInput(deleteQuestionQuerySchema, query);
    return this.editor.deleteQuestion(actor, parseId(id), parseId(questionId), revision);
  }

  @Post(':id/questions/reorder')
  @ApiOperation({ summary: 'Réordonner les questions (liste complète)' })
  @ApiBody({ schema: openApiSchema(reorderQuestionsInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  reorder(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ReorderQuestionsInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.reorderQuestions(actor, parseId(id), body);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Soumettre le questionnaire à l’approbation du responsable' })
  @ApiBody({ schema: openApiSchema(submitEvaluationInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  submit(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SubmitEvaluationInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.submit(actor, parseId(id), body);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Reprendre la rédaction après une demande de corrections' })
  @ApiBody({ schema: openApiSchema(versionActionInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  resume(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: VersionActionInput,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.resume(actor, parseId(id), body);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Créer une nouvelle version de travail (copie de la version publiée)' })
  @ApiCreatedResponse(detail)
  newVersion(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<EditorEvaluationDetail> {
    return this.editor.newVersion(actor, parseId(id));
  }
}
