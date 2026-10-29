import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  type AddEvidenceInput,
  type CancelModuleStudyInput,
  type ChangeStageInput,
  type CreateCompetencyInput,
  type CreateProposalInput,
  type DeclareModuleStudyInput,
  type ProposalAuthorActionInput,
  type ProposalDecisionInput,
  type RecordModuleStudyInput,
  type RevokeValidationInput,
  type UpdateCompetencyInput,
  addEvidenceInputSchema,
  cancelModuleStudyInputSchema,
  changeStageInputSchema,
  type Competency,
  type CompetencyListQuery,
  competencySchema,
  type CompetencyValidation,
  competencyValidationSchema,
  createCompetencyInputSchema,
  createProposalInputSchema,
  declareModuleStudyInputSchema,
  type ModuleStudy,
  moduleStudySchema,
  type MyProgression,
  myProgressionSchema,
  type Paginated,
  paginatedSchema,
  type Proposal,
  proposalAuthorActionInputSchema,
  proposalDecisionInputSchema,
  type ProposalListQuery,
  proposalSchema,
  recordModuleStudyInputSchema,
  revokeValidationInputSchema,
  type ScoutProgression,
  scoutProgressionSchema,
  type ScoutTimeline,
  scoutTimelineSchema,
  type StageChange,
  stageChangeSchema,
  type StageListResponse,
  stageListResponseSchema,
  updateCompetencyInputSchema,
} from '@tesla/shared';
import { z } from 'zod';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { CompetenciesService } from './competencies.service.js';
import { CompetencyProposalsService } from './competency-proposals.service.js';
import { ProgressionService } from './progression.service.js';
import { ScoutProgressionService } from './scout-progression.service.js';

const moduleOptionListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), code: z.string(), title: z.string() })),
});

@ApiTags('Progression')
@ApiCookieAuth()
@Controller('progression')
export class ProgressionController {
  constructor(
    private readonly progression: ProgressionService,
    private readonly scouts: ScoutProgressionService,
  ) {}

  @Get('stages')
  @ApiOperation({ summary: 'Étapes de progression (Noviciat → Départ routier)' })
  @ApiOkResponse({ schema: openApiSchema(stageListResponseSchema) })
  async stages(): Promise<StageListResponse> {
    return { items: await this.progression.listStages() };
  }

  @Get('published-modules')
  @ApiOperation({ summary: 'Modules publiés (choix d’un module étudié ou associé)' })
  @ApiOkResponse({ schema: openApiSchema(moduleOptionListSchema) })
  async publishedModules(@CurrentActor() actor: Actor) {
    return { items: await this.scouts.publishedModules(actor) };
  }
}

/** Dossier de progression d'un routier (encadrement) et décisions d'étape (responsable). */
@ApiTags('Progression')
@ApiCookieAuth()
@Controller('scouts/:id')
export class ScoutProgressionController {
  constructor(private readonly scouts: ScoutProgressionService) {}

  @Get('progression')
  @ApiOperation({
    summary: 'Progression complète d’un routier (avec ou sans compte)',
    description: 'Étapes, compétences, décisions, études, évaluations, présences.',
  })
  @ApiOkResponse({ schema: openApiSchema(scoutProgressionSchema) })
  progression(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutProgression> {
    return this.scouts.progression(actor, parseId(id));
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Historique chronologique unifié du routier' })
  @ApiOkResponse({ schema: openApiSchema(scoutTimelineSchema) })
  timeline(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ScoutTimeline> {
    return this.scouts.timeline(actor, parseId(id));
  }

  @Post('stage-changes')
  @ApiOperation({
    summary: 'Changer l’étape (responsable, décision motivée et confirmée)',
    description:
      'Transaction : historique + étape courante + audit. 409 STAGE_CHANGED_MEANWHILE si l’étape lue est périmée. `correctsChangeId` : correction tracée de la dernière décision.',
  })
  @ApiBody({ schema: openApiSchema(changeStageInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(stageChangeSchema) })
  changeStage(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<StageChange> {
    return this.scouts.changeStage(actor, parseId(id), body as ChangeStageInput);
  }

  @Post('module-studies')
  @ApiOperation({
    summary: 'Enregistrer l’étude d’un module (chef ou responsable)',
    description: 'Information de suivi : n’implique ni maîtrise ni validation.',
  })
  @ApiBody({ schema: openApiSchema(recordModuleStudyInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(moduleStudySchema) })
  recordStudy(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ModuleStudy> {
    return this.scouts.recordStudy(actor, parseId(id), body as RecordModuleStudyInput);
  }
}

@ApiTags('Progression')
@ApiCookieAuth()
@Controller('module-studies')
export class ModuleStudiesController {
  constructor(private readonly scouts: ScoutProgressionService) {}

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler une saisie erronée (auteur ou responsable, motif)' })
  @ApiBody({ schema: openApiSchema(cancelModuleStudyInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(moduleStudySchema) })
  cancel(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ModuleStudy> {
    return this.scouts.cancelStudy(actor, parseId(id), body as CancelModuleStudyInput);
  }
}

/** Espace du routier connecté. */
@ApiTags('Mon espace')
@ApiCookieAuth()
@Controller('me')
export class MyProgressionController {
  constructor(private readonly scouts: ScoutProgressionService) {}

  @Get('progression')
  @ApiOperation({ summary: 'Ma progression (décisions officielles, compétences, modules étudiés)' })
  @ApiOkResponse({ schema: openApiSchema(myProgressionSchema) })
  progression(@CurrentActor() actor: Actor): Promise<MyProgression> {
    return this.scouts.mine(actor);
  }

  @Post('module-studies')
  @ApiOperation({ summary: 'Déclarer avoir étudié un module publié (lecture numérique)' })
  @ApiBody({ schema: openApiSchema(declareModuleStudyInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(moduleStudySchema) })
  declare(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<ModuleStudy> {
    return this.scouts.declareStudy(actor, body as DeclareModuleStudyInput);
  }
}

@ApiTags('Compétences')
@ApiCookieAuth()
@Controller('competencies')
export class CompetenciesController {
  constructor(private readonly competencies: CompetenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Référentiel de compétences (filtres : étape, statut, recherche)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'stageId', required: false, description: 'UUID ou « none »' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'all'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(competencySchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: CompetencyListQuery,
  ): Promise<Paginated<Competency>> {
    return this.competencies.list(actor, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une compétence' })
  @ApiOkResponse({ schema: openApiSchema(competencySchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<Competency> {
    return this.competencies.get(actor, parseId(id));
  }

  @Post()
  @ApiOperation({ summary: 'Créer une compétence (responsable)' })
  @ApiBody({ schema: openApiSchema(createCompetencyInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(competencySchema) })
  create(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<Competency> {
    return this.competencies.create(actor, body as CreateCompetencyInput);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier ou désactiver une compétence (responsable)' })
  @ApiBody({ schema: openApiSchema(updateCompetencyInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(competencySchema) })
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Competency> {
    return this.competencies.update(actor, parseId(id), body as UpdateCompetencyInput);
  }
}

@ApiTags('Compétences')
@ApiCookieAuth()
@Controller('competency-proposals')
export class CompetencyProposalsController {
  constructor(private readonly proposals: CompetencyProposalsService) {}

  @Get()
  @ApiOperation({ summary: 'Propositions de validation (file du responsable, suivi des chefs)' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'open (défaut), closed, all ou un statut précis',
  })
  @ApiQuery({ name: 'scoutProfileId', required: false })
  @ApiQuery({ name: 'competencyId', required: false })
  @ApiQuery({ name: 'mine', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(proposalSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: ProposalListQuery,
  ): Promise<Paginated<Proposal>> {
    return this.proposals.list(actor, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Proposition, éléments justificatifs et historique' })
  @ApiOkResponse({ schema: openApiSchema(proposalSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<Proposal> {
    return this.proposals.get(actor, parseId(id));
  }

  @Post()
  @ApiOperation({
    summary: 'Proposer la validation d’une compétence (chef ou responsable)',
    description: '409 PROPOSAL_ALREADY_OPEN, 422 NOT_ENOUGH_EVIDENCE selon le référentiel.',
  })
  @ApiBody({ schema: openApiSchema(createProposalInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  create(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<Proposal> {
    return this.proposals.create(actor, body as CreateProposalInput);
  }

  @Post(':id/evidences')
  @ApiOperation({ summary: 'Ajouter des éléments justificatifs (auteur ou responsable)' })
  @ApiBody({ schema: openApiSchema(addEvidenceInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  addEvidence(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Proposal> {
    return this.proposals.addEvidence(actor, parseId(id), body as AddEvidenceInput);
  }

  @Post(':id/resubmit')
  @ApiOperation({ summary: 'Soumettre à nouveau après une demande de complément' })
  @ApiBody({ schema: openApiSchema(proposalAuthorActionInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  resubmit(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Proposal> {
    return this.proposals.resubmit(actor, parseId(id), body as ProposalAuthorActionInput);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Retirer une proposition ouverte (auteur ou responsable)' })
  @ApiBody({ schema: openApiSchema(proposalAuthorActionInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  withdraw(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Proposal> {
    return this.proposals.withdraw(actor, parseId(id), body as ProposalAuthorActionInput);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Valider officiellement l’acquis (responsable, justification)' })
  @ApiBody({ schema: openApiSchema(proposalDecisionInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  approve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.proposals.decide(actor, parseId(id), 'APPROUVEE', body as ProposalDecisionInput);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Refuser avec motif : compétence « à retravailler » (responsable)' })
  @ApiBody({ schema: openApiSchema(proposalDecisionInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  reject(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.proposals.decide(actor, parseId(id), 'REFUSEE', body as ProposalDecisionInput);
  }

  @Post(':id/request-complement')
  @ApiOperation({ summary: 'Demander un complément à l’auteur (responsable, motif)' })
  @ApiBody({ schema: openApiSchema(proposalDecisionInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(proposalSchema) })
  requestComplement(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.proposals.decide(
      actor,
      parseId(id),
      'COMPLEMENT_DEMANDE',
      body as ProposalDecisionInput,
    );
  }
}

@ApiTags('Compétences')
@ApiCookieAuth()
@Controller('competency-validations')
export class CompetencyValidationsController {
  constructor(private readonly proposals: CompetencyProposalsService) {}

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Révoquer une décision officielle (responsable, motif, tracé)' })
  @ApiBody({ schema: openApiSchema(revokeValidationInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(competencyValidationSchema) })
  revoke(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CompetencyValidation> {
    return this.proposals.revokeValidation(actor, parseId(id), body as RevokeValidationInput);
  }
}
