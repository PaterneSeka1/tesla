import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AssignLeaderInput,
  assignLeaderInputSchema,
  type EndLeaderInput,
  endLeaderInputSchema,
  type LeaderFunction,
  type LeadershipAdmin,
  type LeadershipAssignment,
  type LeadershipMember,
  type LeadershipTeam,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const userSummary = { select: { id: true, firstName: true, lastName: true } } as const;

const assignmentInclude = {
  user: userSummary,
  assignedBy: userSummary,
  endedBy: userSummary,
} as const satisfies Prisma.LeadershipAssignmentInclude;

type AssignmentRow = Prisma.LeadershipAssignmentGetPayload<{ include: typeof assignmentInclude }>;

/** Ordre d'affichage : plein, adjoint, assistants. */
const FUNCTION_ORDER: Record<LeaderFunction, number> = { PLEIN: 0, ADJOINT: 1, ASSISTANT: 2 };

function toMember(row: AssignmentRow): LeadershipMember {
  return {
    assignmentId: row.id,
    user: row.user,
    function: row.function,
    since: row.startedAt.toISOString(),
  };
}

function toAssignment(row: AssignmentRow): LeadershipAssignment {
  return {
    id: row.id,
    user: row.user,
    function: row.function,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    reason: row.reason,
    endReason: row.endReason,
    assignedBy: row.assignedBy,
    endedBy: row.endedBy,
    migrated: row.sourceMandateId !== null,
  };
}

const conflict = () =>
  new ConflictException({
    code: 'LEADERSHIP_CHANGED',
    message: 'L’encadrement vient d’être modifié. Actualisez la page puis recommencez.',
  });

/**
 * Fonctions d'encadrement (D132) : le responsable plein, l'adjoint et les assistants sont désignés
 * directement par l'administrateur, sans année scoute ni délégation. Chaque changement est
 * transactionnel, sérialisé, journalisé et historisé. Les droits suivent dès la requête suivante :
 * ils sont recalculés à chaque requête par la garde de session.
 */
@Injectable()
export class LeadershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Composition actuelle, visible de tout membre connecté (noms et fonctions uniquement). */
  async team(actor: Actor): Promise<LeadershipTeam> {
    assertCan(actor, 'leadership.read');
    return { members: await this.currentMembers() };
  }

  async admin(actor: Actor): Promise<LeadershipAdmin> {
    assertCan(actor, 'leadership.manage');
    const [members, staff, current, history] = await Promise.all([
      this.currentMembers(),
      this.prisma.user.findMany({
        where: { role: 'ENCADREMENT', isActive: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.leadershipAssignment.findMany({
        where: { endedAt: null },
        select: { userId: true, function: true },
      }),
      this.prisma.leadershipAssignment.findMany({
        include: assignmentInclude,
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const functionOf = new Map(current.map((row) => [row.userId, row.function]));
    return {
      members,
      staff: staff.map((user) => ({ ...user, currentFunction: functionOf.get(user.id) ?? null })),
      history: history.map(toAssignment),
    };
  }

  /**
   * Désigne une personne à une fonction. Sa fonction précédente éventuelle prend fin ; désigner un
   * nouveau responsable plein met fin à la fonction du plein actuel (remplacement confirmé). La
   * personne remplacée garde son compte et les accès de l'encadrement, sans les décisions officielles.
   */
  async assign(actor: Actor, input: AssignLeaderInput): Promise<LeadershipAssignment> {
    assertCan(actor, 'leadership.manage');
    const data = parseInput(assignLeaderInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Un seul changement d'encadrement à la fois (les index uniques restent le dernier rempart).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leadership_assignments'))`;
        const user = await tx.user.findUnique({
          where: { id: data.userId },
          select: { isActive: true, role: true },
        });
        if (!user || !user.isActive || user.role !== 'ENCADREMENT') {
          throw new BadRequestException({
            code: 'NOT_STAFF',
            message: 'Seul un compte actif de l’encadrement peut recevoir une fonction.',
          });
        }
        const [previous, currentPlein] = await Promise.all([
          tx.leadershipAssignment.findFirst({ where: { userId: data.userId, endedAt: null } }),
          data.function === 'PLEIN'
            ? tx.leadershipAssignment.findFirst({ where: { function: 'PLEIN', endedAt: null } })
            : null,
        ]);
        if (previous?.function === data.function) {
          throw new ConflictException({
            code: 'ALREADY_IN_FUNCTION',
            message: 'Cette personne exerce déjà cette fonction.',
          });
        }
        const replaced = currentPlein && currentPlein.userId !== data.userId ? currentPlein : null;
        if (replaced && !data.confirmReplacement) {
          throw new ConflictException({
            code: 'PLEIN_REPLACEMENT_UNCONFIRMED',
            message: 'Un responsable plein est déjà en fonction : confirmez son remplacement.',
          });
        }
        const now = new Date();
        const endings = [
          ...(replaced ? [{ row: replaced, reason: 'Remplacé comme responsable plein.' }] : []),
          ...(previous ? [{ row: previous, reason: 'Changement de fonction.' }] : []),
        ];
        for (const { row, reason } of endings) {
          const { count } = await tx.leadershipAssignment.updateMany({
            where: { id: row.id, endedAt: null },
            data: { endedAt: now, endedById: actor.userId, endReason: reason },
          });
          if (count !== 1) throw conflict();
        }
        const created = await tx.leadershipAssignment.create({
          data: {
            userId: data.userId,
            function: data.function,
            startedAt: now,
            reason: data.reason ?? null,
            assignedById: actor.userId,
          },
          include: assignmentInclude,
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'leadership.assigned',
            entityType: 'LeadershipAssignment',
            entityId: created.id,
            metadata: {
              userId: data.userId,
              function: data.function,
              previousFunction: previous?.function ?? null,
              replacedUserId: replaced?.userId ?? null,
            },
          },
        });
        return toAssignment(created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict();
      throw error;
    }
  }

  /** Met fin à une fonction (la personne garde son compte et les accès de l'encadrement). */
  async end(actor: Actor, id: string, input: EndLeaderInput): Promise<LeadershipAssignment> {
    assertCan(actor, 'leadership.manage');
    const data = parseInput(endLeaderInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leadership_assignments'))`;
      const row = await tx.leadershipAssignment.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException({
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Fonction introuvable.',
        });
      }
      if (row.endedAt) {
        throw new ConflictException({
          code: 'ASSIGNMENT_ALREADY_ENDED',
          message: 'Cette fonction a déjà pris fin.',
        });
      }
      const updated = await tx.leadershipAssignment.update({
        where: { id },
        data: { endedAt: new Date(), endedById: actor.userId, endReason: data.reason },
        include: assignmentInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'leadership.ended',
          entityType: 'LeadershipAssignment',
          entityId: id,
          metadata: { userId: row.userId, function: row.function, reason: data.reason },
        },
      });
      return toAssignment(updated);
    });
  }

  private async currentMembers(): Promise<LeadershipMember[]> {
    const rows = await this.prisma.leadershipAssignment.findMany({
      where: { endedAt: null },
      include: assignmentInclude,
    });
    return rows
      .sort(
        (a, b) =>
          FUNCTION_ORDER[a.function] - FUNCTION_ORDER[b.function] ||
          a.startedAt.getTime() - b.startedAt.getTime(),
      )
      .map(toMember);
  }
}
