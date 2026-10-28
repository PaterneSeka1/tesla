import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Client Prisma partagé. La connexion est ouverte à la première requête :
 * l'API démarre même si PostgreSQL est indisponible (le healthcheck le signale).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5_000 }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
