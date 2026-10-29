import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateDelegationInput,
  createDelegationInputSchema,
  type CreateScoutYearInput,
  createScoutYearInputSchema,
  type Delegation,
  type EndMandateInput,
  endMandateInputSchema,
  type LeadershipOverview,
  type LegacyRole,
  type Mandate,
  type MandateHistory,
  type ReconductionDraft,
  type RecordMandateInput,
  recordMandateInputSchema,
  type RevokeDelegationInput,
  revokeDelegationInputSchema,
  type ScoutYear,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isExclusionViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { activeDelegationWhere, activeMandateWhere, civilToday } from './leadership-rules.js';

const userSummary = { select: { id: true, firstName: true, lastName: true } } as const;

const mandateInclude = {
  user: userSummary,
  scoutYear: { select: { id: true, label: true } },
  recordedBy: userSummary,
} as const satisfies Prisma.LeadershipMandateInclude;

type MandateRow = Prisma.LeadershipMandateGetPayload<{ include: typeof mandateInclude }>;

const delegationInclude = {
  delegator: userSummary,
  delegate: userSummary,
} as const satisfies Prisma.DelegationInclude;

type DelegationRow = Prisma.DelegationGetPayload<{ include: typeof delegationInclude }>;

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

function toScoutYear(row: { id: string; label: string; startsOn: Date; endsOn: Date }): ScoutYear {
  return { id: row.id, label: row.label, startsOn: iso(row.startsOn), endsOn: iso(row.endsOn) };
}

function toMandate(row: MandateRow, today: Date): Mandate {
  const effectiveEnd = row.endedEarlyOn ?? row.endsOn;
  return {
    id: row.id,
    user: row.user,
    function: row.function,
    scoutYear: row.scoutYear,
    startsOn: iso(row.startsOn),
    endsOn: iso(row.endsOn),
    endedEarlyOn: row.endedEarlyOn ? iso(row.endedEarlyOn) : null,
    endReason: row.endReason,
    effectiveEndOn: iso(effectiveEnd),
    kind: row.kind,
    appointingAuthority: row.appointingAuthority,
    appointmentReference: row.appointmentReference,
    previousMandateId: row.previousMandateId,
    notes: row.notes,
    recordedBy: row.recordedBy,
    createdAt: row.createdAt.toISOString(),
    active: row.startsOn <= today && effectiveEnd >= today,
  };
}

function toDelegation(row: DelegationRow, activeIds: ReadonlySet<string>): Delegation {
  return {
    id: row.id,
    delegator: row.delegator,
    delegate: row.delegate,
    permissions: row.permissions,
    startsOn: iso(row.startsOn),
    endsOn: iso(row.endsOn),
    reason: row.reason,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokeReason: row.revokeReason,
    createdAt: row.createdAt.toISOString(),
    active: activeIds.has(row.id),
  };
}

const mandateNotFound = () =>
  new NotFoundException({ code: 'MANDATE_NOT_FOUND', message: 'Mandat introuvable.' });

/**
 * Mandats annuels de l'encadrement, années scoutes et délégations (D100–D103).
 * Aucun mandat n'est créé, reconduit ou terminé automatiquement : chaque acte est explicite,
 * confirmé, attribué à son auteur et journalisé.
 */
@Injectable()
export class LeadershipService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: Actor): Promise<LeadershipOverview> {
    assertCan(actor, 'mandate.read');
    const today = civilToday();
    const [years, current, staff, delegations, activeDelegations] = await Promise.all([
      this.prisma.scoutYear.findMany({ orderBy: { startsOn: 'desc' } }),
      this.prisma.leadershipMandate.findMany({
        where: activeMandateWhere(today),
        include: mandateInclude,
        orderBy: [{ function: 'asc' }, { startsOn: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { role: 'ENCADREMENT', isActive: true },
        select: { id: true, firstName: true, lastName: true, legacyRole: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.delegation.findMany({
        where: { endsOn: { gte: today } },
        include: delegationInclude,
        orderBy: { startsOn: 'asc' },
      }),
      this.prisma.delegation.findMany({
        where: activeDelegationWhere(today),
        select: { id: true },
      }),
    ]);
    const withMandate = new Set(current.map((m) => m.userId));
    const activeIds = new Set(activeDelegations.map((d) => d.id));
    const currentYear = years.find((y) => y.startsOn <= today && y.endsOn >= today);
    return {
      today: iso(today),
      currentScoutYear: currentYear ? toScoutYear(currentYear) : null,
      scoutYears: years.map(toScoutYear),
      current: current.map((row) => toMandate(row, today)),
      vacancies: {
        plein: !current.some((m) => m.function === 'PLEIN'),
        adjoint: !current.some((m) => m.function === 'ADJOINT'),
      },
      withoutMandate: staff
        .filter((user) => !withMandate.has(user.id))
        .map(({ legacyRole, ...user }) => ({
          ...user,
          legacyRole: legacyRole as LegacyRole | null,
        })),
      delegations: delegations.map((row) => toDelegation(row, activeIds)),
    };
  }

  async history(
    actor: Actor,
    query: { scoutYearId?: string; userId?: string },
  ): Promise<MandateHistory> {
    assertCan(actor, 'mandate.read');
    const today = civilToday();
    const rows = await this.prisma.leadershipMandate.findMany({
      where: {
        ...(query.scoutYearId ? { scoutYearId: query.scoutYearId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
      },
      include: mandateInclude,
      orderBy: [{ startsOn: 'desc' }, { function: 'asc' }],
    });
    return { mandates: rows.map((row) => toMandate(row, today)) };
  }

  async createScoutYear(actor: Actor, input: CreateScoutYearInput): Promise<ScoutYear> {
    assertCan(actor, 'scoutYear.manage');
    const data = parseInput(createScoutYearInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.scoutYear.create({
          data: {
            label: data.label,
            startsOn: toDate(data.startsOn),
            endsOn: toDate(data.endsOn),
            createdById: actor.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'scoutYear.created',
            entityType: 'ScoutYear',
            entityId: row.id,
            metadata: { label: row.label, startsOn: data.startsOn, endsOn: data.endsOn },
          },
        });
        return toScoutYear(row);
      });
    } catch (error) {
      if (isUniqueViolation(error) || isExclusionViolation(error, 'scout_years_no_overlap')) {
        throw new ConflictException({
          code: 'SCOUT_YEAR_CONFLICT',
          message: 'Cette année scoute existe déjà ou chevauche une année existante.',
        });
      }
      throw error;
    }
  }

  /** Nomination, reconduction, remplacement ou changement de fonction : toujours un nouveau mandat. */
  async record(actor: Actor, input: RecordMandateInput): Promise<Mandate> {
    const data = parseInput(recordMandateInputSchema, input);
    assertCan(actor, data.function === 'PLEIN' ? 'mandate.recordPlein' : 'mandate.recordTeam');
    if (data.userId === actor.userId) {
      throw new ForbiddenException({
        code: 'SELF_APPOINTMENT',
        message: 'Personne ne peut consigner sa propre nomination ou reconduction.',
      });
    }
    const [user, year] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: data.userId } }),
      this.prisma.scoutYear.findUnique({ where: { id: data.scoutYearId } }),
    ]);
    if (!user || !user.isActive || user.role !== 'ENCADREMENT') {
      throw new BadRequestException({
        code: 'NOT_STAFF',
        message: 'Seul un compte actif de l’encadrement peut recevoir un mandat.',
      });
    }
    if (!year) {
      throw new NotFoundException({
        code: 'SCOUT_YEAR_NOT_FOUND',
        message: 'Année scoute introuvable.',
      });
    }
    const startsOn = data.startsOn ?? iso(year.startsOn);
    const endsOn = data.endsOn ?? iso(year.endsOn);
    if (startsOn < iso(year.startsOn) || endsOn > iso(year.endsOn) || endsOn < startsOn) {
      throw new BadRequestException({
        code: 'MANDATE_OUTSIDE_YEAR',
        message: `Le mandat doit être compris dans l’année scoute ${year.label}.`,
      });
    }
    await this.checkPrevious(data, startsOn);

    const today = civilToday();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.leadershipMandate.create({
          data: {
            userId: data.userId,
            function: data.function,
            scoutYearId: data.scoutYearId,
            startsOn: toDate(startsOn),
            endsOn: toDate(endsOn),
            kind: data.kind,
            appointingAuthority: data.appointingAuthority,
            appointmentReference: data.appointmentReference ?? null,
            previousMandateId: data.previousMandateId ?? null,
            notes: data.notes ?? null,
            recordedById: actor.userId,
          },
          include: mandateInclude,
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: `mandate.${data.kind.toLowerCase()}`,
            entityType: 'LeadershipMandate',
            entityId: row.id,
            metadata: {
              userId: data.userId,
              function: data.function,
              scoutYear: year.label,
              startsOn,
              endsOn,
              appointingAuthority: data.appointingAuthority,
              previousMandateId: data.previousMandateId ?? null,
            },
          },
        });
        return toMandate(row, today);
      });
    } catch (error) {
      if (isExclusionViolation(error, 'leadership_mandates_one_plein')) {
        throw new ConflictException({
          code: 'PLEIN_OVERLAP',
          message:
            'Un responsable plein exerce déjà sur cette période. Enregistrez d’abord la fin de son mandat.',
        });
      }
      if (isExclusionViolation(error, 'leadership_mandates_one_per_user')) {
        throw new ConflictException({
          code: 'MANDATE_OVERLAP',
          message:
            'Cette personne exerce déjà un mandat sur cette période. Un changement de fonction suppose d’abord la fin du mandat en cours.',
        });
      }
      throw error;
    }
  }

  private async checkPrevious(
    data: { userId: string; function: string; kind: string; previousMandateId?: string | null },
    startsOn: string,
  ): Promise<void> {
    const needsPrevious = data.kind === 'RECONDUCTION' || data.kind === 'CHANGEMENT_FONCTION';
    if (!data.previousMandateId) {
      if (needsPrevious) {
        throw new BadRequestException({
          code: 'PREVIOUS_MANDATE_REQUIRED',
          message: 'Indiquez le mandat précédent concerné.',
        });
      }
      return;
    }
    const previous = await this.prisma.leadershipMandate.findUnique({
      where: { id: data.previousMandateId },
    });
    if (!previous) throw mandateNotFound();
    const previousEnd = iso(previous.endedEarlyOn ?? previous.endsOn);
    const invalid =
      (needsPrevious && previous.userId !== data.userId) ||
      (data.kind === 'RECONDUCTION' && previous.function !== data.function) ||
      (data.kind === 'CHANGEMENT_FONCTION' && previous.function === data.function) ||
      (data.kind === 'REMPLACEMENT' && previous.function !== data.function) ||
      previousEnd >= startsOn;
    if (invalid) {
      throw new BadRequestException({
        code: 'PREVIOUS_MANDATE_MISMATCH',
        message:
          'Le mandat précédent ne correspond pas : même personne et même fonction pour une reconduction, fonction différente pour un changement, et fin antérieure au nouveau mandat.',
      });
    }
  }

  /** Fin anticipée (démission, remplacement, retrait) : le mandat est conservé, jamais supprimé. */
  async end(actor: Actor, mandateId: string, input: EndMandateInput): Promise<Mandate> {
    const data = parseInput(endMandateInputSchema, input);
    const mandate = await this.prisma.leadershipMandate.findUnique({ where: { id: mandateId } });
    if (!mandate) throw mandateNotFound();
    assertCan(actor, mandate.function === 'PLEIN' ? 'mandate.recordPlein' : 'mandate.recordTeam');
    const endsOn = iso(mandate.endsOn);
    if (data.endedEarlyOn < iso(mandate.startsOn) || data.endedEarlyOn > endsOn) {
      throw new BadRequestException({
        code: 'END_OUTSIDE_MANDATE',
        message: 'La date de fin doit être comprise dans la période du mandat.',
      });
    }
    const today = civilToday();
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leadershipMandate.updateMany({
        where: { id: mandateId, endedEarlyOn: null },
        data: {
          endedEarlyOn: toDate(data.endedEarlyOn),
          endReason: data.reason,
          endedById: actor.userId,
        },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'MANDATE_ALREADY_ENDED',
          message: 'La fin de ce mandat a déjà été enregistrée.',
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'mandate.ended_early',
          entityType: 'LeadershipMandate',
          entityId: mandateId,
          metadata: { endedEarlyOn: data.endedEarlyOn, reason: data.reason },
        },
      });
      return toMandate(
        await tx.leadershipMandate.findUniqueOrThrow({
          where: { id: mandateId },
          include: mandateInclude,
        }),
        today,
      );
    });
  }

  /** Préremplit la reconduction pour l'année suivante ; rien n'est enregistré ici. */
  async reconductionDraft(actor: Actor, mandateId: string): Promise<ReconductionDraft> {
    const row = await this.prisma.leadershipMandate.findUnique({
      where: { id: mandateId },
      include: mandateInclude,
    });
    if (!row) throw mandateNotFound();
    assertCan(actor, row.function === 'PLEIN' ? 'mandate.recordPlein' : 'mandate.recordTeam');
    const nextYear = await this.prisma.scoutYear.findFirst({
      where: { startsOn: { gt: row.endedEarlyOn ?? row.endsOn } },
      orderBy: { startsOn: 'asc' },
    });
    let consecutiveCount = 1;
    let cursor = row;
    while (cursor.previousMandateId && cursor.kind === 'RECONDUCTION') {
      const previous = await this.prisma.leadershipMandate.findUnique({
        where: { id: cursor.previousMandateId },
        include: mandateInclude,
      });
      if (!previous) break;
      consecutiveCount += 1;
      cursor = previous;
    }
    return {
      previousMandate: toMandate(row, civilToday()),
      nextScoutYear: nextYear ? toScoutYear(nextYear) : null,
      draft: {
        userId: row.userId,
        function: row.function,
        scoutYearId: nextYear?.id ?? null,
        startsOn: nextYear ? iso(nextYear.startsOn) : null,
        endsOn: nextYear ? iso(nextYear.endsOn) : null,
        kind: 'RECONDUCTION',
        previousMandateId: row.id,
      },
      consecutiveCount,
    };
  }

  async listDelegations(actor: Actor): Promise<Delegation[]> {
    assertCan(actor, 'delegation.read');
    const today = civilToday();
    const [rows, active] = await Promise.all([
      this.prisma.delegation.findMany({
        include: delegationInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.delegation.findMany({
        where: activeDelegationWhere(today),
        select: { id: true },
      }),
    ]);
    const activeIds = new Set(active.map((d) => d.id));
    return rows.map((row) => toDelegation(row, activeIds));
  }

  /** Délégation nominative, limitée dans le temps, par le plein en exercice à un membre sous mandat. */
  async delegate(actor: Actor, input: CreateDelegationInput): Promise<Delegation> {
    assertCan(actor, 'delegation.manage');
    const data = parseInput(createDelegationInputSchema, input);
    if (data.delegateId === actor.userId) {
      throw new BadRequestException({
        code: 'SELF_DELEGATION',
        message: 'Délégation à soi-même impossible.',
      });
    }
    const plein = await this.prisma.leadershipMandate.findFirst({
      where: { userId: actor.userId, function: 'PLEIN', ...activeMandateWhere(civilToday()) },
    });
    const delegateMandate = await this.prisma.leadershipMandate.findFirst({
      where: { userId: data.delegateId, ...activeMandateWhere(toDate(data.startsOn)) },
    });
    if (!plein || data.endsOn > iso(plein.endedEarlyOn ?? plein.endsOn)) {
      throw new BadRequestException({
        code: 'DELEGATION_BEYOND_MANDATE',
        message: 'Une délégation ne peut pas dépasser la fin du mandat du responsable plein.',
      });
    }
    if (!delegateMandate) {
      throw new BadRequestException({
        code: 'DELEGATE_WITHOUT_MANDATE',
        message: 'Le bénéficiaire doit exercer un mandat de l’encadrement à la date de début.',
      });
    }
    const today = civilToday();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.delegation.create({
        data: {
          delegatorId: actor.userId,
          delegateId: data.delegateId,
          permissions: data.permissions,
          startsOn: toDate(data.startsOn),
          endsOn: toDate(data.endsOn),
          reason: data.reason,
        },
        include: delegationInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'delegation.granted',
          entityType: 'Delegation',
          entityId: row.id,
          metadata: {
            delegateId: data.delegateId,
            permissions: data.permissions,
            startsOn: data.startsOn,
            endsOn: data.endsOn,
          },
        },
      });
      const active = row.startsOn <= today && row.endsOn >= today;
      return toDelegation(row, new Set(active ? [row.id] : []));
    });
  }

  async revokeDelegation(
    actor: Actor,
    delegationId: string,
    input: RevokeDelegationInput,
  ): Promise<Delegation> {
    assertCan(actor, 'delegation.manage');
    const { reason } = parseInput(revokeDelegationInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.delegation.updateMany({
        where: { id: delegationId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.userId, revokeReason: reason },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'DELEGATION_NOT_REVOCABLE',
          message: 'Délégation introuvable ou déjà révoquée.',
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'delegation.revoked',
          entityType: 'Delegation',
          entityId: delegationId,
          metadata: { reason },
        },
      });
      const row = await tx.delegation.findUniqueOrThrow({
        where: { id: delegationId },
        include: delegationInclude,
      });
      return toDelegation(row, new Set());
    });
  }
}
