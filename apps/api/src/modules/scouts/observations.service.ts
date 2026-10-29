import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateObservationInput,
  createObservationInputSchema,
  type Observation,
  type ObservationRevision,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type UpdateObservationInput,
  updateObservationInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toIsoDate, toUserSummary, userSummarySelect } from './presenters.js';
import { scoutProfileNotFound } from './scout-profiles.service.js';

const withAuthor = { author: userSummarySelect } as const;

type ObservationWithAuthor = Prisma.ScoutObservationGetPayload<{ include: typeof withAuthor }>;

function observationNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'OBSERVATION_NOT_FOUND',
    message: 'Observation introuvable.',
  });
}

/**
 * Observations d'accompagnement des chefs et du responsable.
 * Une observation n'est jamais une validation officielle : elle ne modifie ni l'étape ni un résultat.
 * Visibilité : `ENCADREMENT` (chefs et responsable) ou `RESPONSABLE` (responsable et auteur).
 * Jamais visibles des routiers. Jamais supprimées ; chaque modification est historisée.
 */
@Injectable()
export class ObservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: Actor,
    scoutProfileId: string,
    query: Partial<PaginationQuery>,
  ): Promise<Paginated<Observation>> {
    assertCan(actor, 'observation.read');
    const { page, pageSize } = parseInput(paginationQuerySchema, query);
    await this.assertScoutExists(scoutProfileId);
    const where: Prisma.ScoutObservationWhereInput = {
      scoutProfileId,
      ...this.visibilityFilter(actor),
    };
    const [total, observations] = await this.prisma.$transaction([
      this.prisma.scoutObservation.count({ where }),
      this.prisma.scoutObservation.findMany({
        where,
        include: withAuthor,
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: observations.map((observation) => this.present(actor, observation)),
      page,
      pageSize,
      total,
    };
  }

  async create(
    actor: Actor,
    scoutProfileId: string,
    input: CreateObservationInput,
  ): Promise<Observation> {
    assertCan(actor, 'observation.create');
    const data = parseInput(createObservationInputSchema, input);
    await this.assertScoutExists(scoutProfileId);
    const observation = await this.prisma.scoutObservation.create({
      data: {
        scoutProfileId,
        authorId: actor.userId,
        observedOn: new Date(data.observedOn),
        content: data.content,
        category: data.category ?? null,
        visibility: data.visibility,
      },
      include: withAuthor,
    });
    return this.present(actor, observation);
  }

  /**
   * Modification par l'auteur uniquement. L'état précédent est conservé (révision) dans la même
   * transaction ; une modification concurrente est refusée au lieu d'être écrasée.
   */
  async update(
    actor: Actor,
    scoutProfileId: string,
    observationId: string,
    input: UpdateObservationInput,
  ): Promise<Observation> {
    assertCan(actor, 'observation.create');
    const data = parseInput(updateObservationInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.findVisible(actor, scoutProfileId, observationId, tx);
      if (previous.authorId !== actor.userId) {
        throw new ForbiddenException({
          code: 'OBSERVATION_NOT_AUTHOR',
          message: 'Seul l’auteur peut modifier cette observation.',
        });
      }
      await tx.scoutObservationRevision.create({
        data: {
          observationId,
          editorId: actor.userId,
          observedOn: previous.observedOn,
          content: previous.content,
          category: previous.category,
          visibility: previous.visibility,
        },
      });
      const { count } = await tx.scoutObservation.updateMany({
        where: { id: observationId, updatedAt: previous.updatedAt },
        data: {
          ...(data.observedOn !== undefined && { observedOn: new Date(data.observedOn) }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.visibility !== undefined && { visibility: data.visibility }),
          editedAt: new Date(),
        },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'OBSERVATION_STATE_CHANGED',
          message: 'Cette observation a été modifiée entre-temps. Rechargez la page.',
        });
      }
      const updated = await tx.scoutObservation.findUniqueOrThrow({
        where: { id: observationId },
        include: withAuthor,
      });
      return this.present(actor, updated);
    });
  }

  /** États antérieurs d'une observation (le plus récent d'abord), selon les mêmes droits de lecture. */
  async revisions(
    actor: Actor,
    scoutProfileId: string,
    observationId: string,
  ): Promise<ObservationRevision[]> {
    assertCan(actor, 'observation.read');
    await this.findVisible(actor, scoutProfileId, observationId);
    const revisions = await this.prisma.scoutObservationRevision.findMany({
      where: { observationId },
      include: { editor: userSummarySelect },
      orderBy: { createdAt: 'desc' },
    });
    return revisions.map((revision) => ({
      id: revision.id,
      editor: toUserSummary(revision.editor)!,
      observedOn: toIsoDate(revision.observedOn),
      content: revision.content,
      category: revision.category,
      visibility: revision.visibility,
      replacedAt: revision.createdAt.toISOString(),
    }));
  }

  private visibilityFilter(actor: Actor): Prisma.ScoutObservationWhereInput {
    if (can(actor, 'observation.readRestricted')) return {};
    return { OR: [{ visibility: 'ENCADREMENT' }, { authorId: actor.userId }] };
  }

  /** Observation lisible par l'acteur ; 404 sinon (son existence n'est pas révélée). */
  private async findVisible(
    actor: Actor,
    scoutProfileId: string,
    observationId: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const observation = await client.scoutObservation.findFirst({
      where: { id: observationId, scoutProfileId, ...this.visibilityFilter(actor) },
    });
    if (!observation) throw observationNotFound();
    return observation;
  }

  private async assertScoutExists(scoutProfileId: string): Promise<void> {
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      select: { id: true },
    });
    if (!profile) throw scoutProfileNotFound();
  }

  private present(actor: Actor, observation: ObservationWithAuthor): Observation {
    return {
      id: observation.id,
      scoutProfileId: observation.scoutProfileId,
      author: toUserSummary(observation.author)!,
      observedOn: toIsoDate(observation.observedOn),
      content: observation.content,
      category: observation.category,
      visibility: observation.visibility,
      createdAt: observation.createdAt.toISOString(),
      editedAt: observation.editedAt?.toISOString() ?? null,
      canEdit: observation.authorId === actor.userId,
    };
  }
}
