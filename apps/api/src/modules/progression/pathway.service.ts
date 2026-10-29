import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ActivateAgeRuleSetInput,
  activateAgeRuleSetInputSchema,
  type AgeRuleSet,
  type AgeRuleSetList,
  type AgeRuleSetSnapshot,
  catchUpDueOn,
  catchUpStatus,
  compareCivilDates,
  type CreateAgeRuleSetInput,
  createAgeRuleSetInputSchema,
  type DecideCatchUpInput,
  decideCatchUpInputSchema,
  type CatchUpObligation,
  type PathwayOverview,
  type ScoutPathway,
  stageGap,
  stagePeriods,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  ageProgressionOf,
  effectiveMembership,
  loadRuleSetRow,
  ruleSetInclude,
  type RuleSetRow,
  todayCivil,
  toSnapshot,
} from './age-rules.js';
import {
  moduleRefSelect,
  scoutProfileNotFound,
  scoutProfileNotLinked,
  scoutRefInclude,
  toModuleRef,
  toScoutRef,
} from './progression-common.js';

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const profileInclude = {
  ...scoutRefInclude,
  currentStage: true,
} as const satisfies Prisma.ScoutProfileInclude;

type ProfileRow = Prisma.ScoutProfileGetPayload<{ include: typeof profileInclude }>;

const obligationInclude = {
  module: moduleRefSelect,
  originStage: true,
  ruleSet: { select: { version: true } },
  decidedBy: userSummarySelect,
} as const satisfies Prisma.CatchUpObligationInclude;

type ObligationRow = Prisma.CatchUpObligationGetPayload<{ include: typeof obligationInclude }>;

/** Module obligatoire publié d'une étape : seule source des obligations de rattrapage. */
interface MandatoryModule {
  moduleId: string;
  stageId: string;
  stageCode: string;
}

/**
 * Obligations attendues (calcul pur) : modules obligatoires publiés des étapes dont la période
 * théorique est échue à la date de référence. Les modules de l'étape en cours ne sont pas des
 * rattrapages ; aucune étape sans période validée ne produit d'obligation (rien n'est présumé).
 */
export function expectedCatchUps(
  birthDate: string,
  rules: AgeRuleSetSnapshot,
  referenceDate: string,
  mandatory: readonly MandatoryModule[],
): { module: MandatoryModule; endedOn: string }[] {
  const ended = new Map(
    stagePeriods(birthDate, rules)
      .filter(
        (period) => period.endsOn !== null && compareCivilDates(period.endsOn, referenceDate) <= 0,
      )
      .map((period) => [period.stageCode, period.endsOn!]),
  );
  return mandatory
    .filter((module) => ended.has(module.stageCode))
    .map((module) => ({ module, endedOn: ended.get(module.stageCode)! }));
}

/**
 * Parcours individuel (AgeBasedProgressionService + CatchUpPlanService) : étape théorique selon l'âge,
 * étape officielle, modules de l'étape, plan de rattrapage. Les calculs sont purs (`@tesla/shared`) ;
 * seule la création idempotente des obligations écrit en base. Aucune décision officielle n'est prise.
 */
@Injectable()
export class PathwayService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Référentiel d'âge ────────────────────────────────────────────────────

  async ruleSets(actor: Actor): Promise<AgeRuleSetList> {
    assertCan(actor, 'ageRules.read');
    const [rows, current] = await Promise.all([
      this.prisma.ageRuleSet.findMany({ include: ruleSetInclude, orderBy: { createdAt: 'desc' } }),
      loadRuleSetRow(this.prisma, todayCivil()),
    ]);
    return { currentVersion: current?.version ?? null, items: rows.map(toAgeRuleSet) };
  }

  async createRuleSet(actor: Actor, input: CreateAgeRuleSetInput): Promise<AgeRuleSet> {
    assertCan(actor, 'ageRules.manage');
    const data = parseInput(createAgeRuleSetInputSchema, input);
    const stages = await this.prisma.progressionStage.findMany({
      where: { code: { in: data.stages.map((rule) => rule.stageCode) } },
    });
    const byCode = new Map(stages.map((stage) => [stage.code, stage.id]));
    const unknown = data.stages.find((rule) => !byCode.has(rule.stageCode));
    if (unknown) {
      throw new BadRequestException({
        code: 'UNKNOWN_STAGE',
        message: `Étape inconnue : ${unknown.stageCode}.`,
      });
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.ageRuleSet.create({
          data: {
            version: data.version,
            sourceReference: data.sourceReference,
            notes: data.notes ?? null,
            branchExitAgeYears: data.branchExitAgeYears,
            catchUpDelayMonths: data.catchUpDelayMonths,
            exitAlertMonths: data.exitAlertMonths,
            stages: {
              create: data.stages.map((rule) => ({
                stageId: byCode.get(rule.stageCode)!,
                startYears: rule.start.years,
                startMonths: rule.start.months,
                endYears: rule.end?.years ?? null,
                endMonths: rule.end?.months ?? null,
                sourceReference: rule.sourceReference,
              })),
            },
          },
          include: ruleSetInclude,
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'ageRules.created',
            entityType: 'AgeRuleSet',
            entityId: row.id,
            metadata: { version: row.version },
          },
        });
        return toAgeRuleSet(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'RULE_SET_EXISTS',
          message: 'Cette version existe déjà.',
        });
      }
      throw error;
    }
  }

  /** Mise en vigueur explicite ; le référentiel devient immuable (trigger). */
  async activateRuleSet(
    actor: Actor,
    id: string,
    input: ActivateAgeRuleSetInput,
  ): Promise<AgeRuleSet> {
    assertCan(actor, 'ageRules.manage');
    const { effectiveFrom } = parseInput(activateAgeRuleSetInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.ageRuleSet.updateMany({
          where: { id, status: 'BROUILLON' },
          data: {
            status: 'EN_VIGUEUR',
            effectiveFrom: toDate(effectiveFrom),
            activatedAt: new Date(),
            activatedById: actor.userId,
          },
        });
        if (count === 0) {
          throw new ConflictException({
            code: 'RULE_SET_NOT_DRAFT',
            message: 'Référentiel introuvable ou déjà en vigueur.',
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'ageRules.activated',
            entityType: 'AgeRuleSet',
            entityId: id,
            metadata: { effectiveFrom },
          },
        });
        return toAgeRuleSet(
          await tx.ageRuleSet.findUniqueOrThrow({ where: { id }, include: ruleSetInclude }),
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EFFECTIVE_DATE_TAKEN',
          message: 'Un référentiel entre déjà en vigueur à cette date.',
        });
      }
      throw error;
    }
  }

  // ─── Parcours ─────────────────────────────────────────────────────────────

  async pathway(actor: Actor, scoutProfileId: string): Promise<ScoutPathway> {
    assertCan(actor, 'catchUp.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      include: profileInclude,
    });
    if (!profile) throw scoutProfileNotFound();
    return this.build(profile);
  }

  async myPathway(actor: Actor): Promise<ScoutPathway> {
    assertCan(actor, 'progression.readOwn');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      include: profileInclude,
    });
    if (!profile) throw scoutProfileNotLinked();
    return this.build(profile);
  }

  /** Recalcul idempotent du plan de rattrapage (lecture, traitement quotidien, inscription). */
  async syncCatchUps(profileId: string, today: string = todayCivil()): Promise<number> {
    const profile = await this.prisma.scoutProfile.findUnique({ where: { id: profileId } });
    if (!profile) return 0;
    const rules = await loadRuleSetRow(this.prisma, today);
    return this.sync(profile, rules, today);
  }

  private async sync(
    profile: { id: string; birthDate: Date | null; membershipStatus: 'ACTIF' | 'SORTI' },
    rules: RuleSetRow | null,
    today: string,
  ): Promise<number> {
    if (!profile.birthDate || !rules) return 0;
    const snapshot = toSnapshot(rules);
    // Plus aucune obligation nouvelle après la sortie de la branche.
    if (effectiveMembership(profile, snapshot, today) === 'SORTI') return 0;
    const progression = ageProgressionOf(profile, snapshot, today);
    const expected = expectedCatchUps(
      iso(profile.birthDate),
      snapshot,
      today,
      await this.mandatoryModules(),
    );
    if (expected.length === 0) return 0;
    const { count } = await this.prisma.catchUpObligation.createMany({
      data: expected.map(({ module, endedOn }) => ({
        scoutProfileId: profile.id,
        moduleId: module.moduleId,
        originStageId: module.stageId,
        ruleSetId: rules.id,
        reason: `Module obligatoire de l’étape ${module.stageCode} (période théorique échue le ${endedOn}, référentiel ${rules.version}).`,
        dueOn: (() => {
          const due = catchUpDueOn(today, snapshot.catchUpDelayMonths, progression.branchExitOn);
          return due ? toDate(due) : null;
        })(),
      })),
      // Idempotence : (routier, module) unique ; une obligation existante n'est jamais réécrite.
      skipDuplicates: true,
    });
    return count;
  }

  private async mandatoryModules(): Promise<MandatoryModule[]> {
    const rows = await this.prisma.pedagogicalModule.findMany({
      where: {
        publishedVersion: {
          is: { obligation: 'OBLIGATOIRE', category: 'ETAPE', stageId: { not: null } },
        },
      },
      select: {
        id: true,
        publishedVersion: { select: { stageId: true, stage: { select: { code: true } } } },
      },
    });
    return rows.flatMap((row) =>
      row.publishedVersion?.stageId && row.publishedVersion.stage
        ? [
            {
              moduleId: row.id,
              stageId: row.publishedVersion.stageId,
              stageCode: row.publishedVersion.stage.code,
            },
          ]
        : [],
    );
  }

  private async build(profile: ProfileRow): Promise<ScoutPathway> {
    const today = todayCivil();
    const rules = await loadRuleSetRow(this.prisma, today);
    await this.sync(profile, rules, today);
    const snapshot = rules && toSnapshot(rules);
    const age = ageProgressionOf(profile, snapshot, today);
    const [stages, obligations, mandatory] = await Promise.all([
      this.prisma.progressionStage.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.catchUpObligation.findMany({
        where: { scoutProfileId: profile.id },
        include: obligationInclude,
        orderBy: [{ originStage: { position: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.mandatoryModules(),
    ]);
    const theoretical = stages.find((stage) => stage.code === age.theoreticalStageCode) ?? null;
    const moduleIds = obligations.map((row) => row.moduleId);

    const [studies, attempts, stageModules] = await Promise.all([
      this.prisma.moduleStudy.groupBy({
        by: ['moduleId'],
        where: { scoutProfileId: profile.id, cancelledAt: null },
        _count: { _all: true },
      }),
      this.prisma.evaluationAttempt.findMany({
        where: {
          scoutProfileId: profile.id,
          status: { not: 'ANNULEE' },
          evaluation: { moduleId: { in: moduleIds } },
        },
        select: { status: true, evaluation: { select: { moduleId: true } } },
      }),
      theoretical
        ? this.prisma.pedagogicalModule.findMany({
            where: { publishedVersion: { is: { stageId: theoretical.id } } },
            select: {
              ...moduleRefSelect.select,
              publishedVersion: { select: { title: true, obligation: true, officialSource: true } },
            },
            orderBy: { number: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    const studiedCount = new Map(studies.map((row) => [row.moduleId, row._count._all]));
    const stillRequired = new Set(mandatory.map((module) => module.moduleId));

    const catchUps = obligations.map((row) =>
      toObligation(row, today, {
        studies: studiedCount.get(row.moduleId) ?? 0,
        attempts: attempts.filter((a) => a.evaluation.moduleId === row.moduleId).length,
        acceptedAttempts: attempts.filter(
          (a) => a.evaluation.moduleId === row.moduleId && a.status === 'VALIDEE',
        ).length,
        stillRequired: stillRequired.has(row.moduleId),
      }),
    );

    return {
      scout: toScoutRef(profile),
      age,
      theoreticalStage: theoretical && toStageSummary(theoretical),
      officialStage: profile.currentStage && toStageSummary(profile.currentStage),
      gap: stageGap(theoretical?.position ?? null, profile.currentStage?.position ?? null),
      membership: {
        status: effectiveMembership(profile, snapshot, today),
        exitedOn: profile.branchExitedOn ? iso(profile.branchExitedOn) : null,
      },
      stageModules: stageModules.map((row) => ({
        ...toModuleRef(row),
        obligation: row.publishedVersion?.obligation ?? null,
        officialSource: row.publishedVersion?.officialSource ?? null,
        studied: (studiedCount.get(row.id) ?? 0) > 0,
      })),
      catchUps,
      catchUpDeadlineUndetermined: catchUps.some(
        (obligation) => obligation.decision === null && obligation.dueOn === null,
      ),
    };
  }

  /** Indicateurs de parcours pour l'encadrement (calculés à la lecture, filtre d'équipe facultatif). */
  async overview(actor: Actor, teamId?: string): Promise<PathwayOverview> {
    assertCan(actor, 'statistics.read');
    const today = todayCivil();
    const rules = await loadRuleSetRow(this.prisma, today);
    const snapshot = rules && toSnapshot(rules);
    const [profiles, stages, obligations] = await Promise.all([
      this.prisma.scoutProfile.findMany({
        where: {
          isActive: true,
          ...(teamId && { teamAssignments: { some: { teamId, endedAt: null } } }),
        },
        include: profileInclude,
      }),
      this.prisma.progressionStage.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.catchUpObligation.findMany({
        where: {
          decision: null,
          ...(teamId && { scoutProfile: { teamAssignments: { some: { teamId, endedAt: null } } } }),
        },
        select: { dueOn: true, scoutProfileId: true, moduleId: true },
      }),
    ]);
    const accepted = await this.prisma.evaluationAttempt.findMany({
      where: {
        status: 'VALIDEE',
        scoutProfileId: { in: obligations.map((o) => o.scoutProfileId) },
        evaluation: { moduleId: { in: obligations.map((o) => o.moduleId) } },
      },
      select: { scoutProfileId: true, evaluation: { select: { moduleId: true } } },
    });
    const awaiting = obligations.filter((o) =>
      accepted.some(
        (a) => a.scoutProfileId === o.scoutProfileId && a.evaluation.moduleId === o.moduleId,
      ),
    ).length;

    const stageCounts = new Map<string | null, number>();
    const gapCounts = new Map<string, number>();
    const upcoming: PathwayOverview['upcomingExits'] = [];
    let active = 0;
    let exited = 0;
    for (const profile of profiles) {
      if (effectiveMembership(profile, snapshot, today) === 'SORTI') {
        exited += 1;
        continue;
      }
      active += 1;
      const age = ageProgressionOf(profile, snapshot, today);
      const theoretical = stages.find((stage) => stage.code === age.theoreticalStageCode) ?? null;
      stageCounts.set(theoretical?.id ?? null, (stageCounts.get(theoretical?.id ?? null) ?? 0) + 1);
      const gap = stageGap(theoretical?.position ?? null, profile.currentStage?.position ?? null);
      gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
      if (age.branchExitOn && age.daysUntilExit !== null) {
        upcoming.push({
          scout: toScoutRef(profile),
          branchExitOn: age.branchExitOn,
          daysUntilExit: age.daysUntilExit,
          approaching: age.approachingExit,
        });
      }
    }
    return {
      referenceDate: today,
      ruleSetVersion: rules?.version ?? null,
      activeMembers: active,
      exitedMembers: exited,
      missingBirthDate: profiles.filter((profile) => !profile.birthDate).length,
      byTheoreticalStage: [
        ...stages
          .filter((stage) => stageCounts.has(stage.id))
          .map((stage) => ({ stage: toStageSummary(stage), count: stageCounts.get(stage.id)! })),
        ...(stageCounts.has(null) ? [{ stage: null, count: stageCounts.get(null)! }] : []),
      ],
      byGap: [...gapCounts].map(([gap, count]) => ({
        gap: gap as PathwayOverview['byGap'][number]['gap'],
        count,
      })),
      upcomingExits: upcoming.sort((a, b) => a.daysUntilExit - b.daysUntilExit).slice(0, 8),
      catchUps: {
        open: obligations.length,
        overdue: obligations.filter((o) => o.dueOn && iso(o.dueOn) < today).length,
        awaitingValidation: awaiting,
        withoutDeadline: obligations.filter((o) => !o.dueOn).length,
      },
    };
  }

  /** Décision humaine (acquis ou non applicable), motivée, définitive, journalisée. */
  async decideCatchUp(
    actor: Actor,
    obligationId: string,
    input: DecideCatchUpInput,
  ): Promise<CatchUpObligation> {
    assertCan(actor, 'catchUp.decide');
    const data = parseInput(decideCatchUpInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.catchUpObligation.updateMany({
        where: { id: obligationId, decision: null },
        data: {
          decision: data.decision,
          decisionReason: data.reason,
          decidedAt: new Date(),
          decidedById: actor.userId,
        },
      });
      if (count === 0) {
        const exists = await tx.catchUpObligation.count({ where: { id: obligationId } });
        if (!exists) {
          throw new NotFoundException({
            code: 'CATCH_UP_NOT_FOUND',
            message: 'Obligation introuvable.',
          });
        }
        throw new ConflictException({
          code: 'CATCH_UP_ALREADY_DECIDED',
          message: 'Une décision a déjà été enregistrée pour cette obligation.',
        });
      }
      const row = await tx.catchUpObligation.findUniqueOrThrow({
        where: { id: obligationId },
        include: obligationInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'catchUp.decided',
          entityType: 'CatchUpObligation',
          entityId: obligationId,
          metadata: {
            scoutProfileId: row.scoutProfileId,
            moduleId: row.moduleId,
            decision: data.decision,
          },
        },
      });
      return toObligation(row, todayCivil(), {
        studies: 0,
        attempts: 0,
        acceptedAttempts: 0,
        stillRequired: true,
      });
    });
  }
}

function toObligation(
  row: ObligationRow,
  today: string,
  facts: { studies: number; attempts: number; acceptedAttempts: number; stillRequired: boolean },
): CatchUpObligation {
  const dueOn = row.dueOn ? iso(row.dueOn) : null;
  return {
    id: row.id,
    module: toModuleRef(row.module),
    originStage: toStageSummary(row.originStage)!,
    ruleSetVersion: row.ruleSet.version,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    dueOn,
    status: catchUpStatus({ decision: row.decision, dueOn, today, ...facts }),
    studies: facts.studies,
    attempts: facts.attempts,
    acceptedAttempts: facts.acceptedAttempts,
    decision: row.decision,
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy && toUserSummary(row.decidedBy),
    stillRequired: facts.stillRequired,
  };
}

function toAgeRuleSet(row: RuleSetRow): AgeRuleSet {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    effectiveFrom: row.effectiveFrom ? iso(row.effectiveFrom) : null,
    sourceReference: row.sourceReference,
    notes: row.notes,
    branchExitAgeYears: row.branchExitAgeYears,
    catchUpDelayMonths: row.catchUpDelayMonths,
    exitAlertMonths: row.exitAlertMonths,
    stages: [...row.stages]
      .sort((a, b) => a.stage.position - b.stage.position)
      .map((rule) => ({
        stageCode: rule.stage.code,
        stageName: rule.stage.name,
        start: { years: rule.startYears, months: rule.startMonths },
        end: rule.endYears === null ? null : { years: rule.endYears, months: rule.endMonths ?? 0 },
        sourceReference: rule.sourceReference,
      })),
    activatedAt: row.activatedAt?.toISOString() ?? null,
  };
}
