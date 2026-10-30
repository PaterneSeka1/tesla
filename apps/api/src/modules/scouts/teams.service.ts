import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AssignTeamInput,
  assignTeamInputSchema,
  type CreateTeamInput,
  createTeamInputSchema,
  type Paginated,
  type Team as TeamResponse,
  type TeamAssignment as TeamAssignmentResponse,
  type TeamDetail,
  type TeamListQuery,
  teamListQuerySchema,
  type UpdateTeamInput,
  updateTeamInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma, type Team, type TeamAssignment } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary, toTeamResponse, toUserSummary, userSummarySelect } from './presenters.js';
import { scoutProfileNotFound } from './scout-profiles.service.js';

const openAssignmentsCount = {
  _count: { select: { assignments: { where: { endedAt: null } } } },
} as const;

function teamNotFound(): NotFoundException {
  return new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Équipe introuvable.' });
}

function teamArchived(): ConflictException {
  return new ConflictException({ code: 'TEAM_ARCHIVED', message: 'Cette équipe est archivée.' });
}

function teamNameTaken(): ConflictException {
  return new ConflictException({
    code: 'TEAM_NAME_TAKEN',
    message: 'Une équipe porte déjà ce nom.',
  });
}

/**
 * Équipes et historique des affectations (RM-003, RM-004).
 * Intégrité garantie aussi en base : une affectation ouverte par routier, périodes sans chevauchement.
 * Une équipe n'est jamais supprimée : elle est archivée, son historique est conservé.
 */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: TeamListQuery): Promise<Paginated<TeamResponse>> {
    assertCan(actor, 'team.read');
    const { page, pageSize, search, status } = parseInput(teamListQuerySchema, query);
    const where: Prisma.TeamWhereInput = {
      ...(status === 'active' && { archivedAt: null }),
      ...(status === 'archived' && { archivedAt: { not: null } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, teams] = await this.prisma.$transaction([
      this.prisma.team.count({ where }),
      this.prisma.team.findMany({
        where,
        include: openAssignmentsCount,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: teams.map((team) => toTeamResponse(team, team._count.assignments)),
      page,
      pageSize,
      total,
    };
  }

  /** Équipe et membres actuels (affectations ouvertes de routiers actifs ou non). */
  async get(actor: Actor, teamId: string): Promise<TeamDetail> {
    assertCan(actor, 'team.read');
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        assignments: {
          where: { endedAt: null },
          include: { scoutProfile: { include: { currentStage: true } } },
          orderBy: [{ scoutProfile: { lastName: 'asc' } }, { scoutProfile: { firstName: 'asc' } }],
        },
      },
    });
    if (!team) throw teamNotFound();
    return {
      ...toTeamResponse(team, team.assignments.length),
      members: team.assignments.map(({ scoutProfile, startedAt }) => ({
        scoutProfileId: scoutProfile.id,
        firstName: scoutProfile.firstName,
        lastName: scoutProfile.lastName,
        matricule: scoutProfile.matricule,
        stage: toStageSummary(scoutProfile.currentStage),
        since: startedAt.toISOString(),
      })),
    };
  }

  async create(actor: Actor, input: CreateTeamInput): Promise<Team> {
    assertCan(actor, 'team.manage');
    const data = parseInput(createTeamInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertNameAvailable(tx, data.name);
        const team = await tx.team.create({
          data: { name: data.name, description: data.description ?? null },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'team.created',
            entityType: 'Team',
            entityId: team.id,
            metadata: { name: team.name },
          },
        });
        return team;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw teamNameTaken();
      throw error;
    }
  }

  async update(actor: Actor, teamId: string, input: UpdateTeamInput): Promise<Team> {
    assertCan(actor, 'team.manage');
    const data = parseInput(updateTeamInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.team.findUnique({ where: { id: teamId } });
        if (!previous) throw teamNotFound();
        if (previous.archivedAt) throw teamArchived();
        if (data.name !== undefined) await assertNameAvailable(tx, data.name, teamId);
        const team = await tx.team.update({
          where: { id: teamId },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'team.updated',
            entityType: 'Team',
            entityId: teamId,
            metadata: {
              previous: { name: previous.name, description: previous.description },
              next: { name: team.name, description: team.description },
            },
          },
        });
        return team;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw teamNameTaken();
      throw error;
    }
  }

  /**
   * Archive une équipe : les affectations ouvertes sont closes (date de fin, auteur) dans la même
   * transaction ; aucune affectation n'est supprimée. Les routiers concernés restent sans équipe.
   */
  async archive(actor: Actor, teamId: string): Promise<{ team: Team; closedAssignments: number }> {
    assertCan(actor, 'team.manage');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ archived_at: Date | null }[]>`
        SELECT archived_at FROM teams WHERE id = ${teamId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw teamNotFound();
      if (rows[0]!.archived_at) {
        throw new ConflictException({
          code: 'TEAM_ALREADY_ARCHIVED',
          message: 'Cette équipe est déjà archivée.',
        });
      }
      const now = new Date();
      const open = await tx.teamAssignment.findMany({ where: { teamId, endedAt: null } });
      if (open.some((assignment) => assignment.startedAt >= now)) {
        throw new UnprocessableEntityException({
          code: 'INVALID_ASSIGNMENT_DATE',
          message: 'Une affectation à cette équipe commence dans le futur : modifiez-la d’abord.',
        });
      }
      const { count } = await tx.teamAssignment.updateMany({
        where: { teamId, endedAt: null },
        data: { endedAt: now, endedById: actor.userId },
      });
      const team = await tx.team.update({ where: { id: teamId }, data: { archivedAt: now } });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'team.archived',
          entityType: 'Team',
          entityId: teamId,
          metadata: { closedAssignments: count },
        },
      });
      return { team, closedAssignments: count };
    });
  }

  /**
   * Affecte un routier à une équipe. L'affectation ouverte précédente est close à la date de début
   * de la nouvelle, dans la même transaction (le profil est verrouillé pour sérialiser les changements).
   */
  async assign(actor: Actor, input: AssignTeamInput): Promise<TeamAssignment> {
    assertCan(actor, 'team.assign');
    const data = parseInput(assignTeamInputSchema, input);
    const startedAt = data.startedAt ? new Date(data.startedAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const scout = await lockScoutProfile(tx, data.scoutProfileId);
      if (!scout.is_active) {
        throw new ConflictException({
          code: 'SCOUT_INACTIVE',
          message: 'Ce routier est désactivé : réactivez-le avant de l’affecter.',
        });
      }
      const team = await tx.team.findUnique({ where: { id: data.teamId } });
      if (!team) throw teamNotFound();
      if (team.archivedAt) throw teamArchived();

      const latest = await tx.teamAssignment.findFirst({
        where: { scoutProfileId: data.scoutProfileId },
        orderBy: { startedAt: 'desc' },
      });
      if (latest && startedAt <= (latest.endedAt ?? latest.startedAt)) {
        throw new UnprocessableEntityException({
          code: 'INVALID_ASSIGNMENT_DATE',
          message: 'La nouvelle affectation doit commencer après la précédente.',
        });
      }
      const openTeamId = latest && latest.endedAt === null ? latest.teamId : null;
      if (data.expectedTeamId !== undefined && data.expectedTeamId !== openTeamId) {
        throw new ConflictException({
          code: 'TEAM_ASSIGNMENT_CHANGED',
          message:
            'L’équipe de ce routier a changé entre-temps. Vérifiez son affectation actuelle avant de la modifier.',
        });
      }
      let previousTeamId: string | null = null;
      if (latest && latest.endedAt === null) {
        if (latest.teamId === data.teamId) {
          throw new ConflictException({
            code: 'ALREADY_IN_TEAM',
            message: 'Ce routier appartient déjà à cette équipe.',
          });
        }
        previousTeamId = latest.teamId;
        await tx.teamAssignment.update({
          where: { id: latest.id },
          data: { endedAt: startedAt, endedById: actor.userId },
        });
      }

      const assignment = await tx.teamAssignment.create({
        data: {
          scoutProfileId: data.scoutProfileId,
          teamId: data.teamId,
          startedAt,
          assignedById: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'team_assignment.created',
          entityType: 'ScoutProfile',
          entityId: data.scoutProfileId,
          metadata: { teamId: data.teamId, previousTeamId, assignmentId: assignment.id },
        },
      });
      return assignment;
    });
  }

  /** Retire un routier de son équipe : il reste temporairement sans équipe. */
  async unassign(actor: Actor, scoutProfileId: string, endedAt = new Date()): Promise<void> {
    assertCan(actor, 'team.assign');
    await this.prisma.$transaction(async (tx) => {
      await lockScoutProfile(tx, scoutProfileId);
      const open = await tx.teamAssignment.findFirst({ where: { scoutProfileId, endedAt: null } });
      if (!open) {
        throw new ConflictException({
          code: 'NO_ACTIVE_TEAM',
          message: 'Ce routier n’a pas d’équipe.',
        });
      }
      if (endedAt <= open.startedAt) {
        throw new UnprocessableEntityException({
          code: 'INVALID_ASSIGNMENT_DATE',
          message: 'La date de fin doit suivre la date de début de l’affectation.',
        });
      }
      await tx.teamAssignment.update({
        where: { id: open.id },
        data: { endedAt, endedById: actor.userId },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'team_assignment.ended',
          entityType: 'ScoutProfile',
          entityId: scoutProfileId,
          metadata: { teamId: open.teamId, assignmentId: open.id },
        },
      });
    });
  }

  /** Historique complet des affectations d'un routier (la plus récente d'abord). */
  async history(actor: Actor, scoutProfileId: string): Promise<TeamAssignmentResponse[]> {
    assertCan(actor, 'scout.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      select: { id: true },
    });
    if (!profile) throw scoutProfileNotFound();
    const assignments = await this.prisma.teamAssignment.findMany({
      where: { scoutProfileId },
      include: { team: true, assignedBy: userSummarySelect, endedBy: userSummarySelect },
      orderBy: { startedAt: 'desc' },
    });
    return assignments.map((assignment) => ({
      id: assignment.id,
      team: {
        id: assignment.team.id,
        name: assignment.team.name,
        archived: assignment.team.archivedAt !== null,
      },
      startedAt: assignment.startedAt.toISOString(),
      endedAt: assignment.endedAt?.toISOString() ?? null,
      assignedBy: toUserSummary(assignment.assignedBy),
      endedBy: toUserSummary(assignment.endedBy),
    }));
  }

  /** Équipe du routier à une date donnée (ex. date de préparation d'une ancienne évaluation). */
  async teamAt(
    scoutProfileId: string,
    at: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Team | null> {
    const assignment = await client.teamAssignment.findFirst({
      where: {
        scoutProfileId,
        startedAt: { lte: at },
        OR: [{ endedAt: null }, { endedAt: { gt: at } }],
      },
      include: { team: true },
    });
    return assignment?.team ?? null;
  }
}

/** Nom unique sans distinction de casse (« Lions » et « lions » sont la même équipe). */
async function assertNameAvailable(
  tx: Prisma.TransactionClient,
  name: string,
  exceptId?: string,
): Promise<void> {
  const homonym = await tx.team.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { NOT: { id: exceptId } }),
    },
    select: { id: true },
  });
  if (homonym) throw teamNameTaken();
}

/** Verrouille le profil (sérialise les changements d'équipe concurrents) ; 404 s'il n'existe pas. */
export async function lockScoutProfile(
  tx: Prisma.TransactionClient,
  scoutProfileId: string,
): Promise<{ id: string; is_active: boolean }> {
  const rows = await tx.$queryRaw<{ id: string; is_active: boolean }[]>`
    SELECT id, is_active FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw scoutProfileNotFound();
  return rows[0]!;
}
