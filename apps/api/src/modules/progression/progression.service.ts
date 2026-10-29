import { Injectable } from '@nestjs/common';
import { type StageSummary } from '@tesla/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary } from '../scouts/presenters.js';

@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Référentiel des étapes (données de référence, lisibles par tout utilisateur connecté). */
  async listStages(): Promise<StageSummary[]> {
    const stages = await this.prisma.progressionStage.findMany({ orderBy: { position: 'asc' } });
    return stages.map((stage) => toStageSummary(stage)!);
  }
}
