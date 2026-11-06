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
  type CatchUpArrival,
  catchUpStageSchedule,
  catchUpReferenceDate,
  catchUpStatus,
  civilDateAt,
  compareCivilDates,
  type CreateAgeRuleSetInput,
  createAgeRuleSetInputSchema,
  type DecideCatchUpInput,
  decideCatchUpInputSchema,
  type CatchUpObligation,
  type PathwayOverview,
  type ScoutPathway,
  stagePeriods,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { assertCanAtWrite } from '../auth/write-authority.js';
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
  stillRequiredModuleWhere,
  type RuleSetRow,
  todayCivil,
  toSnapshot,
} from './age-rules.js';
import { endedStages, isModuleLocked, loadCatchUpLock, toCatchUpLock } from './catch-up-lock.js';
import { computedStageOf, loadStageContext, type StageContext } from './computed-stage.js';
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
  /** Date civile de publication de la version obligatoire (nulle si inconnue). */
  publishedOn?: string | null;
}

/** Motif présenté à qui ne supervise pas la progression : aucune règle interne (D176). */
const PUBLIC_CATCH_UP_REASON = 'Module obligatoire d’une étape antérieure.';

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
 * Position de l'échéance de l'étape d'origine par rapport à l'entrée à la Route : information de
 * suivi seulement (une arrivée tardive ne dispense d'aucun module).
 */
export function catchUpArrival(
  endedOn: string | undefined,
  joinedAt: string | null,
): CatchUpArrival {
  if (!endedOn || !joinedAt) return 'INCONNUE';
  return compareCivilDates(endedOn, joinedAt) <= 0 ? 'AVANT_ARRIVEE' : 'APRES_ARRIVEE';
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
        // Décision officielle : fonction du plein revérifiée au moment de l'écriture (D173).
        await assertCanAtWrite(tx, actor, 'ageRules.manage');
        const row = await tx.ageRuleSet.create({
          data: {
            version: data.version,
            sourceReference: data.sourceReference,
            notes: data.notes ?? null,
            branchExitAgeYears: data.branchExitAgeYears,
            catchUpDelayMonths: data.catchUpDelayMonths,
            catchUpDelayDays: data.catchUpDelayDays ?? null,
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
        await assertCanAtWrite(tx, actor, 'ageRules.manage');
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
    return this.build(profile, can(actor, 'progression.supervise'));
  }

  async myPathway(actor: Actor): Promise<ScoutPathway> {
    assertCan(actor, 'progression.readOwn');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      include: profileInclude,
    });
    if (!profile) throw scoutProfileNotLinked();
    return this.build(profile, false);
  }

  /** Recalcul idempotent du plan de rattrapage (lecture, traitement quotidien, inscription). */
  async syncCatchUps(profileId: string, today: string = todayCivil()): Promise<number> {
    const profile = await this.prisma.scoutProfile.findUnique({ where: { id: profileId } });
    if (!profile) return 0;
    const rules = await loadRuleSetRow(this.prisma, today);
    const stages = await this.prisma.progressionStage.findMany();
    return this.sync(profile, rules, today, stages);
  }

  private async sync(
    profile: {
      id: string;
      birthDate: Date | null;
      joinedAt: Date | null;
      membershipStatus: 'ACTIF' | 'SORTI';
    },
    rules: RuleSetRow | null,
    today: string,
    stages: readonly { code: string; position: number }[],
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
    const existing = await this.prisma.catchUpObligation.findMany({
      where: { scoutProfileId: profile.id },
      select: {
        moduleId: true,
        decision: true,
        dueOn: true,
        originStage: { select: { code: true } },
      },
    });
    const known = new Set(existing.map((row) => row.moduleId));
    // Délai jamais rétroactif : arrivée, publication ou référentiel postérieurs (D176).
    const referenceOf = (item: (typeof expected)[number]) =>
      catchUpReferenceDate({
        stageEndedOn: item.endedOn,
        joinedOn: profile.joinedAt && iso(profile.joinedAt),
        createdOn: today,
        modulePublishedOn: item.module.publishedOn ?? null,
        ruleSetEffectiveFrom: rules.effectiveFrom && iso(rules.effectiveFrom),
      });
    // Étapes à rattraper dans l'ordre du parcours, chacune avec son délai, à la suite de la
    // précédente (D177) ; une échéance déjà enregistrée pour une étape est conservée.
    const fresh = expected.filter((item) => !known.has(item.module.moduleId));
    if (fresh.length === 0) return 0;
    const position = (code: string) => stages.find((stage) => stage.code === code)?.position ?? 0;
    const stageCodes = [
      ...new Set([
        ...fresh.map((item) => item.module.stageCode),
        ...existing.filter((row) => row.decision === null).map((row) => row.originStage.code),
      ]),
    ].sort((a, b) => position(a) - position(b));
    const schedule = catchUpStageSchedule(
      stageCodes.map((code) => {
        const references = expected
          .filter((item) => item.module.stageCode === code)
          .map(referenceOf);
        const existingDue = existing
          .filter((row) => row.decision === null && row.originStage.code === code && row.dueOn)
          .map((row) => iso(row.dueOn!))
          .sort(compareCivilDates)[0];
        return {
          stageCode: code,
          reference: references.sort(compareCivilDates).at(-1) ?? today,
          existingDueOn: existingDue ?? null,
        };
      }),
      snapshot,
      progression.branchExitOn,
    );
    const { count } = await this.prisma.catchUpObligation.createMany({
      data: fresh.map(({ module, endedOn }) => ({
        scoutProfileId: profile.id,
        moduleId: module.moduleId,
        originStageId: module.stageId,
        ruleSetId: rules.id,
        reason: `Module obligatoire de l’étape ${module.stageCode} (période théorique échue le ${endedOn}, référentiel ${rules.version}).`,
        dueOn: (() => {
          const due = schedule.get(module.stageCode) ?? null;
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
      where: stillRequiredModuleWhere,
      select: {
        id: true,
        publishedVersion: {
          select: { stageId: true, publishedAt: true, stage: { select: { code: true } } },
        },
      },
    });
    return rows.flatMap((row) =>
      row.publishedVersion?.stageId && row.publishedVersion.stage
        ? [
            {
              moduleId: row.id,
              stageId: row.publishedVersion.stageId,
              stageCode: row.publishedVersion.stage.code,
              publishedOn: row.publishedVersion.publishedAt
                ? civilDateAt(row.publishedVersion.publishedAt)
                : null,
            },
          ]
        : [],
    );
  }

  /**
   * Effets d'une date de naissance hypothétique sur le plan de rattrapage, sans écriture : nouvelles
   * obligations attendues et obligations sans décision qui ne seraient plus échues.
   */
  async catchUpImpact(
    profileId: string,
    birthDate: string | null,
    context: StageContext,
  ): Promise<{ newCatchUps: number; catchUpsToReview: number }> {
    const [existing, mandatory] = await Promise.all([
      this.prisma.catchUpObligation.findMany({
        where: { scoutProfileId: profileId },
        select: { moduleId: true, decision: true, originStage: { select: { code: true } } },
      }),
      this.mandatoryModules(),
    ]);
    const ended = endedStages(birthDate, context.rules, context.today);
    const exited =
      birthDate !== null &&
      ageProgressionOf({ birthDate: toDate(birthDate) }, context.rules, context.today)
        .membership === 'SORTI';
    const known = new Set(existing.map((row) => row.moduleId));
    return {
      newCatchUps: exited
        ? 0
        : mandatory.filter((module) => ended.has(module.stageCode) && !known.has(module.moduleId))
            .length,
      catchUpsToReview: existing.filter(
        (row) => row.decision === null && !ended.has(row.originStage.code),
      ).length,
    };
  }

  /**
   * Parcours : étape **appliquée** (âge ou exception de secours, D176), calendrier cohérent avec
   * elle, modules de cette étape, rattrapages (toujours issus du calcul normal par l'âge : une
   * exception n'en efface aucun). `supervise` : détails internes (référentiel, motifs détaillés)
   * réservés au responsable plein ; les autres profils n'en reçoivent pas.
   */
  private async build(profile: ProfileRow, supervise: boolean): Promise<ScoutPathway> {
    const context = await loadStageContext(this.prisma);
    const { today, ruleSet: rules, rules: snapshot } = context;
    await this.sync(profile, rules, today, context.stages);
    const computed = computedStageOf(profile, context);
    const age = computed.progression;
    const stage = computed.stage;
    const [obligations, mandatory] = await Promise.all([
      this.prisma.catchUpObligation.findMany({
        where: { scoutProfileId: profile.id },
        include: obligationInclude,
        orderBy: [{ originStage: { position: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.mandatoryModules(),
    ]);
    const moduleIds = obligations.map((row) => row.moduleId);
    const lock = await loadCatchUpLock(this.prisma, profile, context);

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
      stage
        ? this.prisma.pedagogicalModule.findMany({
            where: { publishedVersion: { is: { stageId: stage.id } } },
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
    const ended = endedStages(profile.birthDate && iso(profile.birthDate), snapshot, today);
    const joinedAt = profile.joinedAt && iso(profile.joinedAt);

    const catchUps = obligations.map((row) =>
      toObligation(row, today, {
        studies: studiedCount.get(row.moduleId) ?? 0,
        attempts: attempts.filter((a) => a.evaluation.moduleId === row.moduleId).length,
        acceptedAttempts: attempts.filter(
          (a) => a.evaluation.moduleId === row.moduleId && a.status === 'VALIDEE',
        ).length,
        stillRequired: stillRequired.has(row.moduleId),
        stillDue: ended.has(row.originStage.code),
        arrival: catchUpArrival(ended.get(row.originStage.code), joinedAt),
        blocking: lock.blockingModuleIds.has(row.moduleId),
      }),
    );

    return {
      scout: toScoutRef(profile),
      age: supervise ? age : { ...age, ruleSetVersion: null },
      stage: toStageSummary(stage),
      membership: {
        status: effectiveMembership(profile, snapshot, today),
        exitedOn: profile.branchExitedOn ? iso(profile.branchExitedOn) : null,
      },
      stageModules: stageModules.map((row) => ({
        ...toModuleRef(row),
        obligation: row.publishedVersion?.obligation ?? null,
        officialSource: row.publishedVersion?.officialSource ?? null,
        studied: (studiedCount.get(row.id) ?? 0) > 0,
        locked: isModuleLocked(lock, row.id),
      })),
      catchUps: supervise
        ? catchUps
        : catchUps.map((row) => ({
            ...row,
            ruleSetVersion: null,
            reason: PUBLIC_CATCH_UP_REASON,
          })),
      catchUpLock: toCatchUpLock(lock),
      catchUpDeadlineUndetermined: catchUps.some(
        (obligation) => obligation.decision === null && obligation.dueOn === null,
      ),
    };
  }

  /** Indicateurs de parcours pour l'encadrement (calculés à la lecture, filtre d'équipe facultatif). */
  async overview(actor: Actor, teamId?: string): Promise<PathwayOverview> {
    assertCan(actor, 'statistics.read');
    const context = await loadStageContext(this.prisma);
    const { today, ruleSet: rules, rules: snapshot, stages } = context;
    const [profiles, obligations] = await Promise.all([
      this.prisma.scoutProfile.findMany({
        where: {
          isActive: true,
          ...(teamId && { teamAssignments: { some: { teamId, endedAt: null } } }),
        },
        include: profileInclude,
      }),
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
    const upcoming: PathwayOverview['upcomingExits'] = [];
    let active = 0;
    let exited = 0;
    for (const profile of profiles) {
      if (effectiveMembership(profile, snapshot, today) === 'SORTI') {
        exited += 1;
        continue;
      }
      active += 1;
      const { stage, progression: age } = computedStageOf(profile, context);
      stageCounts.set(stage?.id ?? null, (stageCounts.get(stage?.id ?? null) ?? 0) + 1);
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
      // Version du référentiel : détail interne réservé au responsable plein (D176).
      ruleSetVersion: can(actor, 'progression.supervise') ? (rules?.version ?? null) : null,
      activeMembers: active,
      exitedMembers: exited,
      missingBirthDate: profiles.filter((profile) => !profile.birthDate).length,
      byStage: [
        ...stages
          .filter((stage) => stageCounts.has(stage.id))
          .map((stage) => ({ stage: toStageSummary(stage), count: stageCounts.get(stage.id)! })),
        ...(stageCounts.has(null) ? [{ stage: null, count: stageCounts.get(null)! }] : []),
      ],
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
        stillDue: true,
        arrival: 'INCONNUE',
        blocking: false,
      });
    });
  }
}

function toObligation(
  row: ObligationRow,
  today: string,
  facts: {
    studies: number;
    attempts: number;
    acceptedAttempts: number;
    stillRequired: boolean;
    stillDue: boolean;
    arrival: CatchUpArrival;
    blocking: boolean;
  },
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
    stillDue: facts.stillDue,
    arrival: facts.arrival,
    blocking: facts.blocking,
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
    catchUpDelayDays: row.catchUpDelayDays,
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
