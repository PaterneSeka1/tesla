import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  compareCivilDates,
  type CreateStageOverrideInput,
  createStageOverrideInputSchema,
  daysBetween,
  lastDayInBranch,
  type LiftStageOverrideInput,
  liftStageOverrideInputSchema,
  type PreviewStageOverrideInput,
  previewStageOverrideInputSchema,
  type StageOverride,
  type StageOverridePreview,
  stageOverrideStatus,
  stagePeriods,
  type StageSupervision,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isExclusionViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma, type ProgressionStage } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertCanAtWrite } from '../auth/write-authority.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import { computedStageOf, loadStageContext, type StageContext } from './computed-stage.js';
import { scoutProfileNotFound, scoutRefInclude, toScoutRef } from './progression-common.js';

// Correction exceptionnelle et temporaire de l'étape (procédure de secours, D176). Réservée au
// responsable plein en fonction (`progression.supervise`, revérifiée dans la transaction). La
// progression par l'âge reste la règle : l'exception ne modifie ni la date de naissance, ni la date
// d'entrée, ni les acquis, ni les obligations de rattrapage, ni la sortie de la branche.

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const overrideInclude = {
  stage: true,
  computedStage: true,
  createdBy: userSummarySelect,
  liftedBy: userSummarySelect,
} as const satisfies Prisma.StageOverrideInclude;

type OverrideRow = Prisma.StageOverrideGetPayload<{ include: typeof overrideInclude }>;

type ProfileRow = Prisma.ScoutProfileGetPayload<{ include: typeof scoutRefInclude }>;

const unprocessable = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

@Injectable()
export class StageOverridesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Supervision (règles, périodes, étape normale et appliquée, exceptions) : plein seulement. */
  async supervision(actor: Actor, scoutProfileId: string): Promise<StageSupervision> {
    assertCan(actor, 'progression.supervise');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      include: scoutRefInclude,
    });
    if (!profile) throw scoutProfileNotFound();
    const [context, rows] = await Promise.all([
      loadStageContext(this.prisma),
      this.prisma.stageOverride.findMany({
        where: { scoutProfileId },
        include: overrideInclude,
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const computed = computedStageOf(profile, context);
    const exitOn = computed.normalProgression.branchExitOn;
    const overrides = rows.map((row) => toOverride(row, context.today, exitOn));
    const birthDate = profile.birthDate && iso(profile.birthDate);
    const stageByCode = new Map(context.stages.map((stage) => [stage.code, stage]));
    return {
      scout: toScoutRef(profile),
      referenceDate: context.today,
      ruleSetVersion: context.ruleSet?.version ?? null,
      catchUpDelayMonths: context.ruleSet?.catchUpDelayMonths ?? null,
      catchUpDelayDays: context.ruleSet?.catchUpDelayDays ?? null,
      birthDate,
      joinedAt: profile.joinedAt && iso(profile.joinedAt),
      age: computed.normalProgression.age,
      computedStage: toStageSummary(computed.computedStage),
      computedReason: computed.computedReason,
      activeOverride: overrides.find((row) => row.id === computed.override?.id) ?? null,
      effectiveStage: toStageSummary(computed.stage),
      periods:
        birthDate && context.rules
          ? stagePeriods(birthDate, context.rules).flatMap((period) => {
              const stage = stageByCode.get(period.stageCode);
              return stage
                ? [
                    {
                      stage: toStageSummary(stage)!,
                      startsOn: period.startsOn,
                      endsOn: period.endsOn,
                    },
                  ]
                : [];
            })
          : [],
      branchExitOn: exitOn,
      membership: computed.reason === 'SORTI' ? 'SORTI' : computed.normalProgression.membership,
      allowedStages: context.stages
        .filter((stage) => stage.id !== computed.computedStage?.id)
        .map((stage) => toStageSummary(stage)!),
      canOverride: canOverride(profile, computed.reason, exitOn),
      overrides,
    };
  }

  /** Conséquences d'une exception, sans écriture. */
  async preview(
    actor: Actor,
    scoutProfileId: string,
    input: PreviewStageOverrideInput,
  ): Promise<StageOverridePreview> {
    assertCan(actor, 'progression.supervise');
    const data = parseInput(previewStageOverrideInputSchema, input);
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      include: scoutRefInclude,
    });
    if (!profile) throw scoutProfileNotFound();
    const context = await loadStageContext(this.prisma);
    const checked = checkRequest(profile, context, data);
    const [requestedStageModules, computedStageModules, openCatchUps, overlapping] =
      await Promise.all([
        this.publishedModules(checked.stage.id),
        checked.computedStage ? this.publishedModules(checked.computedStage.id) : 0,
        this.prisma.catchUpObligation.count({ where: { scoutProfileId, decision: null } }),
        this.prisma.stageOverride.count({
          where: {
            scoutProfileId,
            liftedAt: null,
            startsOn: { lte: toDate(data.endsOn) },
            endsOn: { gte: toDate(data.startsOn) },
          },
        }),
      ]);
    return {
      computedStage: toStageSummary(checked.computedStage),
      requestedStage: toStageSummary(checked.stage)!,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      days: daysBetween(data.startsOn, data.endsOn) + 1,
      lastDayInBranch: checked.lastDay,
      requestedStageModules,
      computedStageModules,
      openCatchUps,
      conflict: overlapping > 0,
    };
  }

  async create(
    actor: Actor,
    scoutProfileId: string,
    input: CreateStageOverrideInput,
  ): Promise<StageOverride> {
    assertCan(actor, 'progression.supervise');
    const data = parseInput(createStageOverrideInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Fonction du plein revérifiée au moment de l'écriture (remplacement concurrent : refus).
        await assertCanAtWrite(tx, actor, 'progression.supervise');
        // Sérialise avec une correction concurrente de la fiche (date de naissance).
        await tx.$queryRaw`SELECT id FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
        const profile = await tx.scoutProfile.findUnique({
          where: { id: scoutProfileId },
          include: scoutRefInclude,
        });
        if (!profile) throw scoutProfileNotFound();
        const context = await loadStageContext(tx);
        const checked = checkRequest(profile, context, data);
        const row = await tx.stageOverride.create({
          data: {
            scoutProfileId,
            stageId: checked.stage.id,
            computedStageId: checked.computedStage?.id ?? null,
            ruleSetVersion: context.ruleSet?.version ?? null,
            reason: data.reason,
            startsOn: toDate(data.startsOn),
            endsOn: toDate(data.endsOn),
            createdById: actor.userId,
          },
          include: overrideInclude,
        });
        // Journal sans le motif (confidentiel, conservé dans l'exception elle-même).
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'stageOverride.created',
            entityType: 'StageOverride',
            entityId: row.id,
            metadata: {
              scoutProfileId,
              stage: checked.stage.code,
              computedStage: checked.computedStage?.code ?? null,
              startsOn: data.startsOn,
              endsOn: data.endsOn,
              ruleSetVersion: context.ruleSet?.version ?? null,
            },
          },
        });
        return toOverride(row, context.today, checked.exitOn);
      });
    } catch (error) {
      if (isExclusionViolation(error, 'stage_overrides_no_overlap')) {
        throw new ConflictException({
          code: 'STAGE_OVERRIDE_CONFLICT',
          message: 'Une exception couvre déjà tout ou partie de cette période.',
        });
      }
      throw error;
    }
  }

  /** Levée anticipée, motivée : l'étape normale reprend immédiatement. */
  async lift(
    actor: Actor,
    overrideId: string,
    input: LiftStageOverrideInput,
  ): Promise<StageOverride> {
    assertCan(actor, 'progression.supervise');
    const data = parseInput(liftStageOverrideInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'progression.supervise');
      const { count } = await tx.stageOverride.updateMany({
        where: { id: overrideId, liftedAt: null },
        data: { liftedAt: new Date(), liftedById: actor.userId, liftReason: data.reason },
      });
      if (count === 0) {
        const exists = await tx.stageOverride.count({ where: { id: overrideId } });
        if (!exists) {
          throw new NotFoundException({
            code: 'STAGE_OVERRIDE_NOT_FOUND',
            message: 'Exception introuvable.',
          });
        }
        throw new ConflictException({
          code: 'STAGE_OVERRIDE_ALREADY_LIFTED',
          message: 'Cette exception a déjà été levée.',
        });
      }
      const row = await tx.stageOverride.findUniqueOrThrow({
        where: { id: overrideId },
        include: { ...overrideInclude, scoutProfile: { select: { birthDate: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'stageOverride.lifted',
          entityType: 'StageOverride',
          entityId: overrideId,
          metadata: { scoutProfileId: row.scoutProfileId, stage: row.stage.code },
        },
      });
      const context = await loadStageContext(tx);
      const exitOn = computedStageOf(
        { id: row.scoutProfileId, birthDate: row.scoutProfile.birthDate },
        context,
      ).normalProgression.branchExitOn;
      return toOverride(row, context.today, exitOn);
    });
  }

  private publishedModules(stageId: string): Promise<number> {
    return this.prisma.pedagogicalModule.count({
      where: { publishedVersion: { is: { stageId } } },
    });
  }
}

function canOverride(
  profile: { birthDate: Date | null; isActive: boolean },
  reason: string,
  exitOn: string | null,
): boolean {
  return profile.birthDate !== null && profile.isActive && reason !== 'SORTI' && exitOn !== null;
}

/**
 * Règles d'une exception (D176) : date de naissance connue, routier actif dans la branche, étape
 * connue et différente de l'étape normale, aucune rétroactivité, fin au plus tard la veille du 21e
 * anniversaire (aucune prolongation possible).
 */
function checkRequest(
  profile: ProfileRow,
  context: StageContext,
  data: { stageCode: string; startsOn: string; endsOn: string },
): {
  stage: ProgressionStage;
  computedStage: ProgressionStage | null;
  exitOn: string;
  lastDay: string;
} {
  const computed = computedStageOf(profile, context);
  const exitOn = computed.normalProgression.branchExitOn;
  if (!profile.birthDate) {
    throw unprocessable(
      'BIRTH_DATE_REQUIRED',
      'Renseignez d’abord la date de naissance du routier.',
    );
  }
  if (computed.reason === 'SORTI') {
    throw unprocessable('SCOUT_EXITED', 'Ce routier est sorti de la branche.');
  }
  if (!profile.isActive) {
    throw unprocessable('SCOUT_INACTIVE', 'Ce profil est désactivé.');
  }
  if (exitOn === null) {
    throw unprocessable('EXIT_DATE_UNKNOWN', 'Aucun référentiel d’âge en vigueur.');
  }
  const stage = context.stages.find((row) => row.code === data.stageCode);
  if (!stage) throw unprocessable('UNKNOWN_STAGE', `Étape inconnue : ${data.stageCode}.`);
  if (stage.id === computed.computedStage?.id) {
    throw unprocessable(
      'STAGE_OVERRIDE_SAME_AS_COMPUTED',
      'Cette étape est déjà l’étape normale du routier.',
    );
  }
  if (compareCivilDates(data.startsOn, context.today) < 0) {
    throw unprocessable(
      'STAGE_OVERRIDE_RETROACTIVE',
      'La date de début ne peut pas précéder aujourd’hui.',
    );
  }
  const lastDay = lastDayInBranch(exitOn);
  if (compareCivilDates(data.endsOn, lastDay) > 0) {
    throw unprocessable(
      'STAGE_OVERRIDE_BEYOND_EXIT',
      'La date de fin ne peut pas dépasser la veille du 21e anniversaire.',
    );
  }
  return { stage, computedStage: computed.computedStage, exitOn, lastDay };
}

function toOverride(row: OverrideRow, today: string, exitOn: string | null): StageOverride {
  const startsOn = iso(row.startsOn);
  const endsOn = iso(row.endsOn);
  const liftedAt = row.liftedAt?.toISOString() ?? null;
  return {
    id: row.id,
    stage: toStageSummary(row.stage)!,
    computedStageAtRequest: toStageSummary(row.computedStage),
    reason: row.reason,
    startsOn,
    endsOn,
    status: stageOverrideStatus({ startsOn, endsOn, liftedAt }, today, exitOn),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy && toUserSummary(row.createdBy),
    liftedAt,
    liftedBy: row.liftedBy && toUserSummary(row.liftedBy),
    liftReason: row.liftReason,
  };
}
