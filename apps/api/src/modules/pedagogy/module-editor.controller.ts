import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AddCollaboratorInput,
  addCollaboratorInputSchema,
  chefCandidateListSchema,
  type CreateLessonInput,
  createLessonInputSchema,
  type CreateModuleInput,
  createModuleInputSchema,
  type CreateResourceInput,
  createResourceInputSchema,
  deleteLessonQuerySchema,
  type EditorModuleDetail,
  editorModuleDetailSchema,
  type EditorModuleListItem,
  editorModuleListItemSchema,
  type EditorModuleListQuery,
  moduleActivityListSchema,
  type ModuleActivityItem,
  type ModuleTextLink,
  type ModuleVersionDetail,
  moduleVersionDetailSchema,
  type Paginated,
  paginatedSchema,
  type ReorderLessonsInput,
  reorderLessonsInputSchema,
  type SetTextLinksInput,
  setTextLinksInputSchema,
  type SubmitModuleInput,
  submitModuleInputSchema,
  textCandidateListSchema,
  type UpdateLessonInput,
  updateLessonInputSchema,
  type UpdateModuleVersionInput,
  updateModuleVersionInputSchema,
  type UserSummary,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId, parseInput } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ModuleEditorService } from './module-editor.service.js';

const detail = { schema: openApiSchema(editorModuleDetailSchema) };

/**
 * Espace éditorial (chefs, responsable). Les écritures renvoient le module à jour ;
 * aucune route de ce contrôleur ne publie un module.
 */
@ApiTags('Rédaction des modules')
@ApiCookieAuth()
@Controller('editor')
export class ModuleEditorController {
  constructor(private readonly editor: ModuleEditorService) {}

  @Get('modules')
  @ApiOperation({ summary: 'Modules sur lesquels je peux intervenir (tous pour le responsable)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(editorModuleListItemSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: EditorModuleListQuery,
  ): Promise<Paginated<EditorModuleListItem>> {
    return this.editor.list(actor, query);
  }

  @Post('modules')
  @ApiOperation({ summary: 'Créer un module (version 1 en brouillon)' })
  @ApiBody({ schema: openApiSchema(createModuleInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async create(
    @CurrentActor() actor: Actor,
    @Body() body: CreateModuleInput,
  ): Promise<EditorModuleDetail> {
    const { id } = await this.editor.create(actor, body);
    return this.editor.get(actor, id);
  }

  @Get('modules/:id')
  @ApiOperation({ summary: 'Module, version de travail, historique, collaborateurs' })
  @ApiOkResponse(detail)
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<EditorModuleDetail> {
    return this.editor.get(actor, parseId(id));
  }

  @Patch('modules/:id')
  @ApiOperation({
    summary: 'Modifier les informations du brouillon',
    description:
      '`versionId` et `revision` obligatoires ; 409 `EDIT_CONFLICT` si la révision est périmée.',
  })
  @ApiBody({ schema: openApiSchema(updateModuleVersionInputSchema, 'input') })
  @ApiOkResponse(detail)
  async update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateModuleVersionInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.updateVersion(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Get('modules/:id/versions/:versionId')
  @ApiOperation({ summary: 'Contenu exact d’une version (aperçu, versions antérieures)' })
  @ApiOkResponse({ schema: openApiSchema(moduleVersionDetailSchema) })
  version(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ): Promise<ModuleVersionDetail> {
    return this.editor.getVersion(actor, parseId(id), parseId(versionId));
  }

  @Post('modules/:id/versions')
  @ApiOperation({
    summary: 'Créer une nouvelle version de travail',
    description:
      'Copie de la version publiée : celle-ci reste visible jusqu’à la publication de la nouvelle.',
  })
  @ApiCreatedResponse(detail)
  async createVersion(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.createVersion(actor, moduleId);
    return this.editor.get(actor, moduleId);
  }

  @Post('modules/:id/resume')
  @ApiOperation({ summary: 'Reprendre la rédaction après une demande de corrections' })
  @ApiBody({ schema: openApiSchema(versionActionInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async resume(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: VersionActionInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.resume(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Post('modules/:id/submit')
  @ApiOperation({ summary: 'Soumettre la version à l’approbation du responsable' })
  @ApiBody({ schema: openApiSchema(submitModuleInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async submit(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SubmitModuleInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.submit(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Post('modules/:id/lessons')
  @ApiOperation({ summary: 'Ajouter une leçon (à la fin)' })
  @ApiBody({ schema: openApiSchema(createLessonInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async addLesson(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateLessonInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.addLesson(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Post('modules/:id/lessons/reorder')
  @ApiOperation({ summary: 'Réordonner les leçons (liste complète des identifiants)' })
  @ApiBody({ schema: openApiSchema(reorderLessonsInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async reorder(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ReorderLessonsInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.reorderLessons(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Patch('lessons/:id')
  @ApiOperation({
    summary: 'Modifier une leçon',
    description:
      '`revision` obligatoire ; contenu structuré validé par liste blanche (aucun HTML).',
  })
  @ApiBody({ schema: openApiSchema(updateLessonInputSchema, 'input') })
  @ApiNoContentResponse()
  @HttpCode(204)
  async updateLesson(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateLessonInput,
  ): Promise<void> {
    await this.editor.updateLesson(actor, parseId(id), body);
  }

  @Delete('lessons/:id')
  @ApiOperation({ summary: 'Supprimer une leçon d’un brouillon' })
  @ApiQuery({ name: 'revision', required: true })
  @ApiNoContentResponse()
  @HttpCode(204)
  async deleteLesson(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Query() query: unknown,
  ): Promise<void> {
    const { revision } = parseInput(deleteLessonQuerySchema, query);
    await this.editor.deleteLesson(actor, parseId(id), revision);
  }

  @Post('modules/:id/resources')
  @ApiOperation({ summary: 'Ajouter une ressource (URL externe)' })
  @ApiBody({ schema: openApiSchema(createResourceInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async addResource(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateResourceInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.addResource(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Get('texts')
  @ApiOperation({ summary: 'Textes fondamentaux pouvant être cités par un module' })
  @ApiOkResponse({ schema: openApiSchema(textCandidateListSchema) })
  async textCandidates(@CurrentActor() actor: Actor): Promise<{ items: ModuleTextLink[] }> {
    return { items: await this.editor.textCandidates(actor) };
  }

  @Put('modules/:id/texts')
  @ApiOperation({ summary: 'Définir les textes fondamentaux cités par le brouillon' })
  @ApiBody({ schema: openApiSchema(setTextLinksInputSchema, 'input') })
  @ApiOkResponse(detail)
  async setTextLinks(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SetTextLinksInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.setTextLinks(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Post('modules/:id/duplicate')
  @ApiOperation({ summary: 'Dupliquer un module (nouveau module en brouillon)' })
  @ApiCreatedResponse(detail)
  async duplicate(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ): Promise<EditorModuleDetail> {
    const { id: created } = await this.editor.duplicate(actor, parseId(id));
    return this.editor.get(actor, created);
  }

  @Delete('resources/:id')
  @ApiOperation({ summary: 'Retirer une ressource d’un brouillon' })
  @ApiNoContentResponse()
  @HttpCode(204)
  async deleteResource(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.editor.deleteResource(actor, parseId(id));
  }

  @Get('chefs')
  @ApiOperation({ summary: 'Chefs actifs pouvant être invités comme collaborateurs' })
  @ApiOkResponse({ schema: openApiSchema(chefCandidateListSchema) })
  async chefs(@CurrentActor() actor: Actor): Promise<{ items: UserSummary[] }> {
    return { items: await this.editor.chefCandidates(actor) };
  }

  @Post('modules/:id/collaborators')
  @ApiOperation({ summary: 'Inviter un chef collaborateur (auteur ou responsable)' })
  @ApiBody({ schema: openApiSchema(addCollaboratorInputSchema, 'input') })
  @ApiCreatedResponse(detail)
  async addCollaborator(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: AddCollaboratorInput,
  ): Promise<EditorModuleDetail> {
    const moduleId = parseId(id);
    await this.editor.addCollaborator(actor, moduleId, body);
    return this.editor.get(actor, moduleId);
  }

  @Delete('modules/:id/collaborators/:userId')
  @ApiOperation({ summary: 'Retirer un collaborateur (historique conservé)' })
  @ApiNoContentResponse()
  @HttpCode(204)
  async removeCollaborator(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.editor.removeCollaborator(actor, parseId(id), parseId(userId));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Activité éditoriale récente sur mes modules' })
  @ApiOkResponse({ schema: openApiSchema(moduleActivityListSchema) })
  async activity(@CurrentActor() actor: Actor): Promise<{ items: ModuleActivityItem[] }> {
    return { items: await this.editor.activity(actor) };
  }
}
