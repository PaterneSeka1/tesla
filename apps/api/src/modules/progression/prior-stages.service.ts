import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type PriorStageList,
  type PriorStageRecognition,
  type RecognizePriorStageInput,
  recognizePriorStageInputSchema,
  type RevokePriorStageInput,
  revokePriorStageInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertCanAtWrite } from '../auth/write-authority.js';
import { scoutProfileNotFound } from '../scouts/presenters.js';
import { loadStageContext } from './computed-stage.js';
import { PathwayService } from './pathway.service.js';
import {
  priorStageInclude,
  type RecognitionRow,
  recordPriorStages,
  toPriorStage,
} from './prior-stages-common.js';
import { assertRouteProfile } from '../scouts/route-profile.js';

// Parcours antérieur reconnu (D181) : étapes accomplies avant l'arrivée sur la plateforme, reconnues
// par le responsable plein en fonction (`progression.supervise`, revérifiée dans la transaction).
// Une reconnaissance n'est ni une validation de module, ni un acquis, ni un changement d'étape (qui
// reste calculée selon l'âge) : elle dispense seulement des rattrapages de l'étape reconnue.
// Jamais supprimée ni modifiée ; une erreur se corrige par une révocation motivée et journalisée.

function alreadyRecognized(): ConflictException {
  return new ConflictException({
    code: 'ALREADY_RECOGNIZED',
    message: 'Cette étape vient d’être reconnue pour ce routier. Actualisez la fiche.',
  });
}

@Injectable()
export class PriorStagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pathway: PathwayService,
  ) {}

  /** Historique complet (révocations comprises) : encadrement. */
  async list(actor: Actor, scoutProfileId: string): Promise<PriorStageList> {
    assertCan(actor, 'catchUp.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      select: { id: true },
    });
    if (!profile) throw scoutProfileNotFound();
    const rows = await this.prisma.priorStageRecognition.findMany({
      where: { scoutProfileId },
      include: priorStageInclude,
      orderBy: [{ stage: { position: 'asc' } }, { recordedAt: 'asc' }],
    });
    return { items: rows.map((row) => toPriorStage(row, true)) };
  }

  async recognize(
    actor: Actor,
    scoutProfileId: string,
    input: RecognizePriorStageInput,
  ): Promise<PriorStageRecognition> {
    assertCan(actor, 'progression.supervise');
    const { expectedUpdatedAt, ...data } = parseInput(recognizePriorStageInputSchema, input);
    await assertRouteProfile(this.prisma, scoutProfileId);
    let row: RecognitionRow;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await assertCanAtWrite(tx, actor, 'progression.supervise');
        // Sérialise avec une correction concurrente de la fiche (date de naissance) ou une autre
        // reconnaissance : la décision la plus récente n'est jamais écrasée.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
        if (locked.length === 0) throw scoutProfileNotFound();
        const profile = await tx.scoutProfile.findUniqueOrThrow({
          where: { id: scoutProfileId },
        });
        if (
          expectedUpdatedAt !== undefined &&
          profile.updatedAt.toISOString() !== new Date(expectedUpdatedAt).toISOString()
        ) {
          throw new ConflictException({
            code: 'SCOUT_PROFILE_CHANGED',
            message:
              'Cette fiche a été modifiée entre-temps. Consultez la version à jour avant de reprendre.',
          });
        }
        if (!profile.isActive) {
          throw new UnprocessableEntityException({
            code: 'SCOUT_INACTIVE',
            message: 'Ce routier est désactivé : son parcours ne peut plus être modifié.',
          });
        }
        const [created] = await recordPriorStages(
          tx,
          actor,
          profile,
          [data],
          await loadStageContext(tx),
        );
        return created!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyRecognized();
      throw error;
    }
    return toPriorStage(row, true);
  }

  /**
   * Révocation motivée (erreur de saisie) : l'ancienne reconnaissance reste lisible avec l'auteur, la
   * date et le motif ; les rattrapages de l'étape redeviennent exigibles (recréés si besoin).
   */
  async revoke(
    actor: Actor,
    recognitionId: string,
    input: RevokePriorStageInput,
  ): Promise<PriorStageRecognition> {
    assertCan(actor, 'progression.supervise');
    const data = parseInput(revokePriorStageInputSchema, input);
    const row = await this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'progression.supervise');
      const found = await tx.$queryRaw<{ revoked_at: Date | null; scout_profile_id: string }[]>`
        SELECT revoked_at, scout_profile_id FROM prior_stage_recognitions
        WHERE id = ${recognitionId}::uuid FOR UPDATE`;
      if (found.length === 0) {
        throw new NotFoundException({
          code: 'PRIOR_STAGE_NOT_FOUND',
          message: 'Reconnaissance introuvable.',
        });
      }
      if (found[0]!.revoked_at) {
        throw new ConflictException({
          code: 'PRIOR_STAGE_ALREADY_REVOKED',
          message: 'Cette reconnaissance a déjà été révoquée.',
        });
      }
      const updated = await tx.priorStageRecognition.update({
        where: { id: recognitionId },
        data: { revokedAt: new Date(), revokedById: actor.userId, revokeReason: data.reason },
        include: priorStageInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'priorStage.revoked',
          entityType: 'PriorStageRecognition',
          entityId: recognitionId,
          metadata: {
            scoutProfileId: updated.scoutProfileId,
            stage: updated.stage.code,
            reason: data.reason,
          },
        },
      });
      return updated;
    });
    await this.pathway.syncCatchUps(row.scoutProfileId);
    return toPriorStage(row, true);
  }
}
