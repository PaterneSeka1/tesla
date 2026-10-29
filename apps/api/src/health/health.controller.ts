import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type HealthResponse } from '@tesla/shared';
import { Public } from '../modules/auth/auth.decorators.js';
import { HealthResponseDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Santé')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "État de l'API et de la base de données" })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
