import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  type ActivityDetail,
  type ActivityListQuery,
  activityListQuerySchema,
  type ActivityStatus,
  type ActivitySummary,
  type AttendanceSheet,
  type ChangeActivityStatusInput,
  changeActivityStatusInputSchema,
  type CreateActivityInput,
  createActivityInputSchema,
  formatModuleCode,
  NOT_RECORDED,
  type Paginated,
  type SaveAttendanceInput,
  saveAttendanceInputSchema,
  type UpdateActivityInput,
  updateActivityInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isForeignKeyViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  isoToDate,
  revisionConflict,
  scoutRefInclude,
  toScoutRef,
} from '../progression/progression-common.js';
import { toIsoDate, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  activityNotFound,
  activitySummaryInclude,
  attendanceCounts,
  attendanceMissingWhere,
  isAttendanceEditable,
  startOfTodayUtc,
  toActivitySummary,
} from './activity-common.js';

type Tx = Prisma.TransactionClient;

const detailInclude = {
  ...activitySummaryInclude,
  programme: { select: { id: true, title: true } },
  modules: {
    include: {
      module: {
        select: {
          id: true,
          number: true,
          slug: true,
          publishedVersion: { select: { title: true } },
          versions: { orderBy: { version: 'desc' }, take: 1, select: { title: true } },
        },
      },
    },
  },
  competencies: {
    include: { competency: { select: { id: true, code: true, name: true } } },
    orderBy: { competency: { code: 'asc' } },
  },
  events: { include: { actor: userSummarySelect }, orderBy: { createdAt: 'desc' } },
  createdBy: userSummarySelect,
} as const satisfies Prisma.ActivityInclude;

/** Transitions autorisées ; une activité réalisée est définitive. */
const TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  PLANIFIEE: ['REALISEE', 'REPORTEE', 'ANNULEE'],
  REPORTEE: ['REALISEE', 'REPORTEE', 'ANNULEE', 'PLANIFIEE'],
  ANNULEE: ['PLANIFIEE'],
  REALISEE: [],
};

function invalidReference(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: 'Catégorie, module, compétence ou programme inconnu.',
  });
}

/**
 * Activités (séances du programme annuel et activités supplémentaires) et présences. Jamais
 * supprimées ; chaque modification sensible est historisée (`activity_events`, ajout seul).
 * Une modification manuelle d'une séance importée la protège des imports suivants.
 */
@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: ActivityListQuery): Promise<Paginated<ActivitySummary>> {
    assertCan(actor, 'activity.read');
    const q = parseInput(activityListQuerySchema, query);
    const words = q.search?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.ActivityWhereInput = {
      ...(q.programmeId && { programmeId: q.programmeId }),
      ...(q.origin && { origin: q.origin }),
      ...(q.status && { status: q.status }),
      ...(q.categoryId && { categories: { some: { categoryId: q.categoryId } } }),
      ...((q.from || q.to) && {
        plannedOn: {
          ...(q.from && { gte: isoToDate(q.from) }),
          ...(q.to && { lte: isoToDate(q.to) }),
        },
      }),
      AND: [
        ...words.map((word) => ({
          OR: [
            { title: { contains: word, mode: 'insensitive' as const } },
            { theme: { contains: word, mode: 'insensitive' as const } },
          ],
        })),
        ...(q.attendanceMissing === 'true' ? [attendanceMissingWhere(startOfTodayUtc())] : []),
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: activitySummaryInclude,
        orderBy: [{ plannedOn: q.order }, { title: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const counts = await attendanceCounts(
      this.prisma,
      rows.map((row) => row.id),
    );
    return {
      items: rows.map((row) => toActivitySummary(row, counts.get(row.id))),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }

  async get(actor: Actor, id: string): Promise<ActivityDetail> {
    assertCan(actor, 'activity.read');
    const row = await this.prisma.activity.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw activityNotFound();
    const counts = await attendanceCounts(this.prisma, [id]);
    return {
      ...toActivitySummary(row, counts.get(id)),
      programme: row.programme,
      description: row.description,
      objectives: row.objectives,
      plannedLocation: row.plannedLocation,
      location: row.location,
      contentDone: row.contentDone,
      difficulties: row.difficulties,
      observations: row.observations,
      report: row.report,
      statusReason: row.statusReason,
      imported: row.importKey !== null,
      manuallyEditedAt: row.manuallyEditedAt?.toISOString() ?? null,
      revision: row.revision,
      modules: row.modules.map(({ module }) => ({
        id: module.id,
        code: formatModuleCode(module.number),
        title: module.publishedVersion?.title ?? module.versions[0]?.title ?? module.slug,
      })),
      competencies: row.competencies.map(({ competency, observed }) => ({
        ...competency,
        observed,
      })),
      events: row.events.map((event) => {
        const changes = (event.changes ?? {}) as { fields?: unknown };
        return {
          id: event.id,
          action: event.action,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          comment: event.comment,
          fields: Array.isArray(changes.fields) ? changes.fields.map(String) : [],
          actor: toUserSummary(event.actor)!,
          createdAt: event.createdAt.toISOString(),
        };
      }),
      createdBy: toUserSummary(row.createdBy)!,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(actor: Actor, input: CreateActivityInput): Promise<ActivityDetail> {
    assertCan(actor, 'activity.manage');
    const data = parseInput(createActivityInputSchema, input);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const activity = await tx.activity.create({
          data: {
            origin: data.origin,
            programmeId: data.programmeId ?? null,
            title: data.title,
            theme: data.theme ?? null,
            description: data.description,
            objectives: data.objectives,
            plannedOn: isoToDate(data.plannedOn),
            plannedLocation: data.plannedLocation ?? null,
            leaderLabel: data.leaderLabel ?? null,
            createdById: actor.userId,
          },
        });
        await this.replaceLinks(tx, activity.id, {
          categoryIds: data.categoryIds,
          moduleIds: data.moduleIds,
          competencyIds: data.competencyIds,
        });
        await tx.activityEvent.create({
          data: {
            activityId: activity.id,
            actorId: actor.userId,
            action: 'CREEE',
            toStatus: 'PLANIFIEE',
          },
        });
        return activity.id;
      });
      return this.get(actor, id);
    } catch (error) {
      if (isForeignKeyViolation(error)) throw invalidReference();
      throw error;
    }
  }

  /** Remplace les associations fournies (catégories, modules, compétences prévues et observées). */
  private async replaceLinks(
    tx: Tx,
    activityId: string,
    links: {
      categoryIds?: string[];
      moduleIds?: string[];
      competencyIds?: string[];
      observedCompetencyIds?: string[];
    },
  ): Promise<void> {
    if (links.categoryIds) {
      await tx.activityCategory.deleteMany({ where: { activityId } });
      await tx.activityCategory.createMany({
        data: [...new Set(links.categoryIds)].map((categoryId) => ({ activityId, categoryId })),
      });
    }
    if (links.moduleIds) {
      await tx.activityModule.deleteMany({ where: { activityId } });
      await tx.activityModule.createMany({
        data: [...new Set(links.moduleIds)].map((moduleId) => ({ activityId, moduleId })),
      });
    }
    if (links.competencyIds || links.observedCompetencyIds) {
      const current = await tx.activityCompetency.findMany({ where: { activityId } });
      const planned = links.competencyIds ?? current.map((row) => row.competencyId);
      const observed = new Set(
        links.observedCompetencyIds ??
          current.filter((row) => row.observed).map((row) => row.competencyId),
      );
      const plannedSet = new Set(planned);
      if ([...observed].some((id) => !plannedSet.has(id))) {
        throw new UnprocessableEntityException({
          code: 'OBSERVED_COMPETENCY_NOT_LINKED',
          message: 'Une compétence observée doit faire partie des compétences de l’activité.',
        });
      }
      await tx.activityCompetency.deleteMany({ where: { activityId } });
      await tx.activityCompetency.createMany({
        data: [...plannedSet].map((competencyId) => ({
          activityId,
          competencyId,
          observed: observed.has(competencyId),
        })),
      });
    }
  }

  /** Verrouille l'activité et vérifie la révision lue. */
  private async lock(tx: Tx, id: string, revision: number) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM activities WHERE id = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) throw activityNotFound();
    const activity = await tx.activity.findUniqueOrThrow({ where: { id } });
    if (activity.revision !== revision) throw revisionConflict();
    return activity;
  }

  async update(actor: Actor, id: string, input: UpdateActivityInput): Promise<ActivityDetail> {
    assertCan(actor, 'activity.manage');
    const { revision, categoryIds, moduleIds, competencyIds, observedCompetencyIds, ...fields } =
      parseInput(updateActivityInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const activity = await this.lock(tx, id, revision);
        const changed = Object.keys(fields).filter(
          (key) => fields[key as keyof typeof fields] !== undefined,
        );
        if (categoryIds) changed.push('categoryIds');
        if (moduleIds) changed.push('moduleIds');
        if (competencyIds) changed.push('competencyIds');
        if (observedCompetencyIds) changed.push('observedCompetencyIds');
        if (changed.length === 0) {
          throw new UnprocessableEntityException({
            code: 'VALIDATION_ERROR',
            message: 'Aucune modification fournie.',
          });
        }
        if (
          fields.plannedOn &&
          fields.plannedOn !== toIsoDate(activity.plannedOn) &&
          activity.status === 'REALISEE'
        ) {
          throw new ConflictException({
            code: 'ACTIVITY_ALREADY_HELD',
            message: 'La date prévue d’une activité réalisée ne se modifie plus.',
          });
        }
        await tx.activity.update({
          where: { id },
          data: {
            ...(fields.title !== undefined && { title: fields.title }),
            ...(fields.theme !== undefined && { theme: fields.theme }),
            ...(fields.description !== undefined && { description: fields.description }),
            ...(fields.objectives !== undefined && { objectives: fields.objectives }),
            ...(fields.plannedOn !== undefined && { plannedOn: isoToDate(fields.plannedOn) }),
            ...(fields.plannedLocation !== undefined && {
              plannedLocation: fields.plannedLocation,
            }),
            ...(fields.leaderLabel !== undefined && { leaderLabel: fields.leaderLabel }),
            ...(fields.location !== undefined && { location: fields.location }),
            ...(fields.contentDone !== undefined && { contentDone: fields.contentDone }),
            ...(fields.difficulties !== undefined && { difficulties: fields.difficulties }),
            ...(fields.observations !== undefined && { observations: fields.observations }),
            ...(fields.report !== undefined && { report: fields.report }),
            ...(activity.importKey !== null && { manuallyEditedAt: new Date() }),
            revision: { increment: 1 },
            updatedById: actor.userId,
          },
        });
        await this.replaceLinks(tx, id, {
          categoryIds,
          moduleIds,
          competencyIds,
          observedCompetencyIds,
        });
        await tx.activityEvent.create({
          data: {
            activityId: id,
            actorId: actor.userId,
            action: 'MODIFIEE',
            changes: { fields: changed },
          },
        });
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw invalidReference();
      throw error;
    }
    return this.get(actor, id);
  }

  /** Changement de statut motivé et historisé (réalisée, reportée, annulée, rétablie). */
  async changeStatus(
    actor: Actor,
    id: string,
    input: ChangeActivityStatusInput,
  ): Promise<ActivityDetail> {
    assertCan(actor, 'activity.manage');
    const data = parseInput(changeActivityStatusInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const activity = await this.lock(tx, id, data.revision);
      if (!TRANSITIONS[activity.status].includes(data.status)) {
        throw new ConflictException({
          code: 'INVALID_ACTIVITY_TRANSITION',
          message: `Transition impossible : l’activité est « ${activity.status} ».`,
        });
      }
      const today = startOfTodayUtc();
      let update: Prisma.ActivityUpdateInput = {};
      let comment: string | null = null;
      const changes: Record<string, unknown> = {};
      switch (data.status) {
        case 'REALISEE':
          if (isoToDate(data.heldOn) > today) {
            throw new UnprocessableEntityException({
              code: 'HELD_DATE_IN_FUTURE',
              message: 'La date de réalisation ne peut pas être postérieure à aujourd’hui.',
            });
          }
          update = {
            heldOn: isoToDate(data.heldOn),
            ...(data.location !== undefined && { location: data.location }),
            statusReason: null,
          };
          break;
        case 'REPORTEE':
          comment = data.reason;
          changes.plannedOn = {
            from: activity.plannedOn.toISOString().slice(0, 10),
            to: data.postponedTo,
          };
          update = { plannedOn: isoToDate(data.postponedTo), statusReason: data.reason };
          break;
        case 'ANNULEE':
        case 'PLANIFIEE':
          comment = data.reason;
          update = { statusReason: data.reason };
          break;
      }
      await tx.activity.update({
        where: { id },
        data: {
          ...update,
          status: data.status,
          ...(activity.importKey !== null && { manuallyEditedAt: new Date() }),
          revision: { increment: 1 },
          updatedBy: { connect: { id: actor.userId } },
        },
      });
      await tx.activityEvent.create({
        data: {
          activityId: id,
          actorId: actor.userId,
          action: 'STATUT_MODIFIE',
          fromStatus: activity.status,
          toStatus: data.status,
          comment,
          changes: {
            fields: ['status', ...Object.keys(changes)],
            ...changes,
          },
        },
      });
    });
    return this.get(actor, id);
  }

  // ─── Présences ────────────────────────────────────────────────────────────

  /**
   * Feuille de présence : routiers actifs et tout routier déjà renseigné (même désactivé depuis).
   * Sans saisie, le statut est « non renseigné » (jamais « absent » par défaut).
   */
  async attendance(actor: Actor, id: string, teamId?: string): Promise<AttendanceSheet> {
    assertCan(actor, 'activity.read');
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: activitySummaryInclude,
    });
    if (!activity) throw activityNotFound();
    const [rows, scouts, counts] = await Promise.all([
      this.prisma.activityAttendance.findMany({
        where: { activityId: id },
        include: { recordedBy: userSummarySelect },
      }),
      this.prisma.scoutProfile.findMany({
        where: {
          OR: [{ isActive: true }, { attendances: { some: { activityId: id } } }],
          ...(teamId && { teamAssignments: { some: { teamId, endedAt: null } } }),
        },
        include: scoutRefInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      attendanceCounts(this.prisma, [id]),
    ]);
    const byScout = new Map(rows.map((row) => [row.scoutProfileId, row]));
    return {
      activity: toActivitySummary(activity, counts.get(id)),
      editable: isAttendanceEditable(activity, startOfTodayUtc()),
      entries: scouts.map((scout) => {
        const row = byScout.get(scout.id);
        return {
          scout: toScoutRef(scout),
          status: row?.status ?? 'NON_RENSEIGNE',
          note: row?.note ?? null,
          recordedBy: toUserSummary(row?.recordedBy ?? null),
          updatedAt: row?.updatedAt.toISOString() ?? null,
        };
      }),
    };
  }

  /**
   * Saisie groupée : une ligne par routier et par activité (contrainte unique) ; une ligne existante
   * est mise à jour. Les changements sont historisés dans `activity_events`.
   */
  async saveAttendance(
    actor: Actor,
    id: string,
    input: SaveAttendanceInput,
  ): Promise<AttendanceSheet> {
    assertCan(actor, 'attendance.record');
    const { entries } = parseInput(saveAttendanceInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; planned_on: Date }[]>`
        SELECT status, planned_on FROM activities WHERE id = ${id}::uuid FOR UPDATE`;
      const activity = rows[0];
      if (!activity) throw activityNotFound();
      if (
        !isAttendanceEditable(
          { status: activity.status, plannedOn: activity.planned_on },
          startOfTodayUtc(),
        )
      ) {
        throw new ConflictException({
          code: 'ATTENDANCE_NOT_EDITABLE',
          message:
            'Les présences se saisissent pour une activité réalisée ou dont la date est passée (pas annulée).',
        });
      }
      const scoutIds = entries.map((entry) => entry.scoutProfileId);
      const [scouts, existing] = await Promise.all([
        tx.scoutProfile.findMany({
          where: { id: { in: scoutIds } },
          select: { id: true, isActive: true },
        }),
        tx.activityAttendance.findMany({
          where: { activityId: id, scoutProfileId: { in: scoutIds } },
        }),
      ]);
      const previous = new Map(existing.map((row) => [row.scoutProfileId, row]));
      if (scouts.length !== scoutIds.length) {
        throw new UnprocessableEntityException({
          code: 'SCOUT_PROFILE_NOT_FOUND',
          message: 'Un des routiers est introuvable.',
        });
      }
      if (scouts.some((scout) => !scout.isActive && !previous.has(scout.id))) {
        throw new UnprocessableEntityException({
          code: 'SCOUT_INACTIVE',
          message: 'Un routier désactivé ne peut pas être ajouté à la feuille de présence.',
        });
      }
      // Saisie différée : une présence modifiée entre-temps par un autre membre n'est pas écrasée.
      const conflicting = entries.filter((entry) => {
        if (entry.expectedStatus === undefined) return false;
        const current = previous.get(entry.scoutProfileId)?.status ?? NOT_RECORDED;
        return current !== entry.expectedStatus && current !== entry.status;
      });
      if (conflicting.length > 0) {
        throw new ConflictException({
          code: 'ATTENDANCE_CHANGED',
          message: `${conflicting.length} présence(s) ont été modifiées entre-temps par un autre membre de l’encadrement. Vérifiez la feuille avant de saisir à nouveau.`,
        });
      }
      const changed: { scoutProfileId: string; from: string; to: string }[] = [];
      for (const entry of entries) {
        const before = previous.get(entry.scoutProfileId);
        const note = entry.note ?? null;
        if (before && before.status === entry.status && before.note === note) continue;
        await tx.activityAttendance.upsert({
          where: {
            activityId_scoutProfileId: { activityId: id, scoutProfileId: entry.scoutProfileId },
          },
          create: {
            activityId: id,
            scoutProfileId: entry.scoutProfileId,
            status: entry.status,
            note,
            recordedById: actor.userId,
          },
          update: { status: entry.status, note, recordedById: actor.userId },
        });
        changed.push({
          scoutProfileId: entry.scoutProfileId,
          from: before?.status ?? 'NON_RENSEIGNE',
          to: entry.status,
        });
      }
      if (changed.length > 0) {
        await tx.activityEvent.create({
          data: {
            activityId: id,
            actorId: actor.userId,
            action: 'PRESENCES_ENREGISTREES',
            comment: `${changed.length} présence(s) enregistrée(s)`,
            changes: { fields: ['attendance'], changed },
          },
        });
      }
    });
    return this.attendance(actor, id);
  }
}
