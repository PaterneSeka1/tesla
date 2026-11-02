import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type EvaluationResults, evaluationResultsSchema } from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { EvaluationResultsService } from './evaluation-results.service.js';

@ApiTags('Rédaction des évaluations')
@ApiCookieAuth()
@Controller('editor/evaluations')
export class EvaluationResultsController {
  constructor(private readonly results: EvaluationResultsService) {}

  @Get(':id/results')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Résultats d’un questionnaire : participation, copies, réponses par question',
    description:
      'Encadrement uniquement (corrigé compris). Aucun classement, aucune valeur estimée.',
  })
  @ApiOkResponse({ schema: openApiSchema(evaluationResultsSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<EvaluationResults> {
    return this.results.results(actor, id);
  }
}
