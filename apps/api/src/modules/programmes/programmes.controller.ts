import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
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
  type ActivityDetail,
  activityDetailSchema,
  type ActivityListQuery,
  type ActivitySummary,
  activitySummarySchema,
  type AttendanceSheet,
  attendanceSheetSchema,
  type ChangeActivityStatusInput,
  changeActivityStatusInputSchema,
  type CreateActivityInput,
  createActivityInputSchema,
  type Paginated,
  paginatedSchema,
  programmeCategoryListSchema,
  type ProgrammeImportInput,
  programmeImportInputSchema,
  type ProgrammeImportReport,
  programmeImportReportSchema,
  programmeListSchema,
  type SaveAttendanceInput,
  saveAttendanceInputSchema,
  type UpdateActivityInput,
  updateActivityInputSchema,
  type UpdateProgrammeCategoryInput,
  updateProgrammeCategoryInputSchema,
} from '@tesla/shared';
import { z } from 'zod';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId, parseInput } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ActivitiesService } from './activities.service.js';
import { ProgrammesService } from './programmes.service.js';

@ApiTags('Programme annuel')
@ApiCookieAuth()
@Controller('programmes')
export class ProgrammesController {
  constructor(private readonly programmes: ProgrammesService) {}

  @Get()
  @ApiOperation({ summary: 'Programmes annuels et avancement' })
  @ApiOkResponse({ schema: openApiSchema(programmeListSchema) })
  async list(@CurrentActor() actor: Actor) {
    return { items: await this.programmes.listProgrammes(actor) };
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Catégories du programme et correspondance proposée avec les étapes',
    description: 'Une correspondance non confirmée n’est utilisée par aucune règle.',
  })
  @ApiOkResponse({ schema: openApiSchema(programmeCategoryListSchema) })
  async categories(@CurrentActor() actor: Actor) {
    return { items: await this.programmes.listCategories(actor) };
  }

  @Patch('categories/:id')
  @ApiOperation({
    summary: 'Modifier ou confirmer la correspondance d’une catégorie (responsable)',
  })
  @ApiBody({ schema: openApiSchema(updateProgrammeCategoryInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(programmeCategoryListSchema) })
  async updateCategory(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateProgrammeCategoryInput,
  ) {
    return { items: await this.programmes.updateCategory(actor, parseId(id), body) };
  }

  @Post(':id/import/preview')
  @ApiOperation({ summary: 'Prévisualiser l’import d’un tableau Markdown (aucune écriture)' })
  @ApiBody({ schema: openApiSchema(programmeImportInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(programmeImportReportSchema) })
  preview(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ProgrammeImportInput,
  ): Promise<ProgrammeImportReport> {
    return this.programmes.previewImport(actor, parseId(id), body);
  }

  @Post(':id/import')
  @ApiOperation({
    summary: 'Importer le programme (responsable, idempotent)',
    description:
      'Refusé (422 IMPORT_HAS_ERRORS) si une ligne est en erreur. Les séances modifiées à la main sont conservées.',
  })
  @ApiBody({ schema: openApiSchema(programmeImportInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(programmeImportReportSchema) })
  apply(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ProgrammeImportInput,
  ): Promise<ProgrammeImportReport> {
    return this.programmes.applyImport(actor, parseId(id), body);
  }
}

@ApiTags('Activités')
@ApiCookieAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Activités (programme et supplémentaires), filtres et pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'programmeId', required: false })
  @ApiQuery({ name: 'origin', required: false, enum: ['PROGRAMME', 'SUPPLEMENTAIRE'] })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PLANIFIEE', 'REPORTEE', 'REALISEE', 'ANNULEE'],
  })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'AAAA-MM-JJ (date prévue)' })
  @ApiQuery({ name: 'to', required: false, description: 'AAAA-MM-JJ (date prévue)' })
  @ApiQuery({ name: 'attendanceMissing', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(activitySummarySchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: ActivityListQuery,
  ): Promise<Paginated<ActivitySummary>> {
    return this.activities.list(actor, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une activité (chef ou responsable)' })
  @ApiBody({ schema: openApiSchema(createActivityInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(activityDetailSchema) })
  create(@CurrentActor() actor: Actor, @Body() body: CreateActivityInput): Promise<ActivityDetail> {
    return this.activities.create(actor, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une activité, compte rendu et historique' })
  @ApiOkResponse({ schema: openApiSchema(activityDetailSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ActivityDetail> {
    return this.activities.get(actor, parseId(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une activité ou son compte rendu (révision lue obligatoire)',
    description: '409 EDIT_CONFLICT si l’activité a été modifiée entre-temps.',
  })
  @ApiBody({ schema: openApiSchema(updateActivityInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(activityDetailSchema) })
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateActivityInput,
  ): Promise<ActivityDetail> {
    return this.activities.update(actor, parseId(id), body);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Changer le statut : réalisée, reportée, annulée ou rétablie' })
  @ApiBody({ schema: openApiSchema(changeActivityStatusInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(activityDetailSchema) })
  changeStatus(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ChangeActivityStatusInput,
  ): Promise<ActivityDetail> {
    return this.activities.changeStatus(actor, parseId(id), body);
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Feuille de présence (non renseigné ≠ absent)' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiOkResponse({ schema: openApiSchema(attendanceSheetSchema) })
  attendance(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Query('teamId') teamId?: string,
  ): Promise<AttendanceSheet> {
    const team = teamId ? parseInput(z.uuid(), teamId) : undefined;
    return this.activities.attendance(actor, parseId(id), team);
  }

  @Put(':id/attendance')
  @ApiOperation({
    summary: 'Enregistrer les présences (saisie groupée)',
    description: '400 si un routier apparaît deux fois ; une ligne existante est mise à jour.',
  })
  @ApiBody({ schema: openApiSchema(saveAttendanceInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(attendanceSheetSchema) })
  saveAttendance(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: SaveAttendanceInput,
  ): Promise<AttendanceSheet> {
    return this.activities.saveAttendance(actor, parseId(id), body);
  }
}
