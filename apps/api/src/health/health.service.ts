import { Injectable, Logger } from '@nestjs/common';
import { type HealthResponse } from '@tesla/shared';
import { APP_VERSION } from '../config/app-version.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const database = await this.pingDatabase();
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
    };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(`Base de données injoignable : ${(error as Error).message}`);
      return 'down';
    }
  }
}
