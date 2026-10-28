import { ApiProperty } from '@nestjs/swagger';
import { type HealthResponse } from '@tesla/shared';

/** Documentation OpenAPI de la réponse (le contrat source est le schéma Zod partagé). */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'], description: '« degraded » si la base est injoignable' })
  status: 'ok' | 'degraded';

  @ApiProperty({ example: '0.1.0' })
  version: string;

  @ApiProperty({ example: 42 })
  uptimeSeconds: number;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ enum: ['up', 'down'] })
  database: 'up' | 'down';
}
