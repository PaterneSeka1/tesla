import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type StageListResponse, stageListResponseSchema } from '@tesla/shared';
import { openApiSchema } from '../../common/openapi.js';
import { ProgressionService } from './progression.service.js';

@ApiTags('Progression')
@ApiCookieAuth()
@Controller('progression')
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get('stages')
  @ApiOperation({ summary: 'Étapes de progression (Noviciat → Départ routier)' })
  @ApiOkResponse({ schema: openApiSchema(stageListResponseSchema) })
  async stages(): Promise<StageListResponse> {
    return { items: await this.progression.listStages() };
  }
}
