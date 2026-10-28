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
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma, type Team, type TeamAssignment } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { scoutProfileNotFound } from './scout-profiles.service.js';

/**
 * Équipes et historique des affectations (RM-003, RM-004).
 * Intégrité garantie aussi en base : une affectation ouverte par routier, périodes sans chevauchement.
 */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: Actor, input: CreateTeamInput): Promise<Team> {
    assertCan(actor, 'team.manage');
    const data = parseInput(createTeamInputSchema, input);
    try {
      return await this.prisma.team.create({
        data: { name: data.name, description: data.description ?? null },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'TEAM_NAME_TAKEN',
          message: 'Une équipe porte déjà ce nom.',
        });
      }
      throw error;
    }
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
      await lockScoutProfile(tx, data.scoutProfileId);
      const team = await tx.team.findUnique({ where: { id: data.teamId } });
      if (!team) {
        throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Équipe introuvable.' });
      }
      if (team.archivedAt) {
        throw new ConflictException({
          code: 'TEAM_ARCHIVED',
          message: 'Cette équipe est archivée.',
        });
      }

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
      if (latest && latest.endedAt === null) {
        if (latest.teamId === data.teamId) {
          throw new ConflictException({
            code: 'ALREADY_IN_TEAM',
            message: 'Ce routier appartient déjà à cette équipe.',
          });
        }
        await tx.teamAssignment.update({
          where: { id: latest.id },
          data: { endedAt: startedAt, endedById: actor.userId },
        });
      }

      return tx.teamAssignment.create({
        data: {
          scoutProfileId: data.scoutProfileId,
          teamId: data.teamId,
          startedAt,
          assignedById: actor.userId,
        },
      });
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
    });
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

async function lockScoutProfile(
  tx: Prisma.TransactionClient,
  scoutProfileId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw scoutProfileNotFound();
}
