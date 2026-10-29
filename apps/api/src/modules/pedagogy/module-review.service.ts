import { ConflictException, Injectable } from '@nestjs/common';
import {
  type ApproveModuleInput,
  approveModuleInputSchema,
  MODULE_DECISION_ACTIONS,
  type ModuleReview,
  type MotivatedDecisionInput,
  motivatedDecisionInputSchema,
  type Paginated,
  type PaginationQuery,
  type PublicationHistoryItem,
  publicationHistoryQuerySchema,
  type SubmissionItem,
  type SubmissionListQuery,
  submissionListQuerySchema,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  eventInclude,
  formatModuleCode,
  invalidTransition,
  lockVersion,
  moduleNotFound,
  recordEvent,
  toActivityItem,
  toVersionSummary,
  versionSummaryInclude,
} from './module-common.js';
import { ModuleEditorService } from './module-editor.service.js';

/**
 * Décisions éditoriales, exclusivement réservées au responsable pédagogique :
 * approbation, demande de corrections, refus, publication (atomique) et archivage.
 * Chaque décision est historisée (`module_version_events`) et journalisée (`audit_logs`)
 * dans la même transaction.
 */
@Injectable()
export class ModuleReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editor: ModuleEditorService,
  ) {}

  /** File de validation des modules (distincte de la future file des évaluations). */
  async submissions(actor: Actor, query: SubmissionListQuery): Promise<SubmissionItem[]> {
    assertCan(actor, 'module.review');
    const { status } = parseInput(submissionListQuerySchema, query);
    const versions = await this.prisma.moduleVersion.findMany({
      where: { status },
      include: {
        ...versionSummaryInclude,
        submittedBy: userSummarySelect,
        module: {
          include: {
            createdBy: userSummarySelect,
            collaborators: { where: { removedAt: null }, include: { user: userSummarySelect } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return versions.map((version) => ({
      moduleId: version.moduleId,
      code: formatModuleCode(version.module.number),
      createdBy: toUserSummary(version.module.createdBy),
      collaborators: version.module.collaborators.map((c) => toUserSummary(c.user)!),
      version: toVersionSummary(version),
      submittedBy: toUserSummary(version.submittedBy),
      submissionNote: version.submissionNote,
      replacesPublished: version.module.publishedVersionId !== null,
    }));
  }

  /** Contenu exact soumis, historique et version publiée actuelle (comparaison). */
  async review(actor: Actor, moduleId: string): Promise<ModuleReview> {
    assertCan(actor, 'module.review');
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { id: moduleId },
      select: { publishedVersionId: true },
    });
    if (!module) throw moduleNotFound();
    const detail = await this.editor.detail(actor, moduleId, 'RESPONSABLE');
    const published =
      module.publishedVersionId && module.publishedVersionId !== detail.current.id
        ? await this.editor.versionDetail(module.publishedVersionId)
        : null;
    return { module: detail, published };
  }

  async approve(actor: Actor, moduleId: string, input: ApproveModuleInput): Promise<void> {
    assertCan(actor, 'module.review');
    const { versionId, comment } = parseInput(approveModuleInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'SOUMIS') throw invalidTransition(locked.status);
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: { status: 'APPROUVE', approvedAt: new Date(), approvedById: actor.userId },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'APPROUVEE',
        fromStatus: 'SOUMIS',
        toStatus: 'APPROUVE',
        comment: comment ?? null,
        audit: 'module.approved',
      });
    });
  }

  /** Renvoi motivé à l'équipe de rédaction (depuis SOUMIS, ou APPROUVE non encore publié). */
  async requestChanges(
    actor: Actor,
    moduleId: string,
    input: MotivatedDecisionInput,
  ): Promise<void> {
    assertCan(actor, 'module.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'SOUMIS' && locked.status !== 'APPROUVE') {
        throw invalidTransition(locked.status);
      }
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: { status: 'A_CORRIGER', approvedAt: null, approvedById: null },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'CORRECTIONS_DEMANDEES',
        fromStatus: locked.status,
        toStatus: 'A_CORRIGER',
        comment,
        audit: 'module.changes_requested',
      });
    });
  }

  /** Refus motivé : la version est close ; une nouvelle version peut être créée ensuite. */
  async reject(actor: Actor, moduleId: string, input: MotivatedDecisionInput): Promise<void> {
    assertCan(actor, 'module.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'SOUMIS') throw invalidTransition(locked.status);
      await tx.moduleVersion.update({ where: { id: versionId }, data: { status: 'REFUSE' } });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'REFUSEE',
        fromStatus: 'SOUMIS',
        toStatus: 'REFUSE',
        comment,
        audit: 'module.rejected',
      });
    });
  }

  /**
   * Publication atomique d'une version approuvée : l'éventuelle version publiée précédente est
   * archivée et le pointeur du module basculé dans la même transaction (jamais deux versions publiées).
   */
  async publish(actor: Actor, moduleId: string, input: VersionActionInput): Promise<void> {
    assertCan(actor, 'module.review');
    const { versionId } = parseInput(versionActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ published_version_id: string | null }[]>`
        SELECT published_version_id FROM pedagogical_modules WHERE id = ${moduleId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw moduleNotFound();
      const previousId = rows[0]!.published_version_id;
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'APPROUVE') {
        throw new ConflictException({
          code: 'VERSION_NOT_APPROVED',
          message: 'Seule une version approuvée peut être publiée.',
        });
      }
      const now = new Date();
      if (previousId) {
        await tx.pedagogicalModule.update({
          where: { id: moduleId },
          data: { publishedVersionId: null },
        });
        await tx.moduleVersion.update({
          where: { id: previousId },
          data: { status: 'ARCHIVE', archivedAt: now },
        });
        await recordEvent(tx, actor, {
          moduleId,
          versionId: previousId,
          action: 'REMPLACEE',
          fromStatus: 'PUBLIE',
          toStatus: 'ARCHIVE',
          comment: `Remplacée par la version ${locked.version}.`,
        });
      }
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLIE', publishedAt: now, publishedById: actor.userId },
      });
      await tx.pedagogicalModule.update({
        where: { id: moduleId },
        data: { publishedVersionId: versionId },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'PUBLIEE',
        fromStatus: 'APPROUVE',
        toStatus: 'PUBLIE',
        audit: 'module.published',
        metadata: { replacedVersionId: previousId },
      });
    });
  }

  /** Retrait motivé de la version publiée : le module disparaît de la bibliothèque. */
  async archive(actor: Actor, moduleId: string, input: MotivatedDecisionInput): Promise<void> {
    assertCan(actor, 'module.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ published_version_id: string | null }[]>`
        SELECT published_version_id FROM pedagogical_modules WHERE id = ${moduleId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw moduleNotFound();
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'PUBLIE' || rows[0]!.published_version_id !== versionId) {
        throw invalidTransition(locked.status);
      }
      await tx.pedagogicalModule.update({
        where: { id: moduleId },
        data: { publishedVersionId: null },
      });
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: { status: 'ARCHIVE', archivedAt: new Date() },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'ARCHIVEE',
        fromStatus: 'PUBLIE',
        toStatus: 'ARCHIVE',
        comment,
        audit: 'module.archived',
      });
    });
  }

  /** Historique des décisions de publication (le plus récent d'abord). */
  async history(actor: Actor, query: PaginationQuery): Promise<Paginated<PublicationHistoryItem>> {
    assertCan(actor, 'module.review');
    const { page, pageSize } = parseInput(publicationHistoryQuerySchema, query);
    const where = { action: { in: [...MODULE_DECISION_ACTIONS] } };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.moduleVersionEvent.count({ where }),
      this.prisma.moduleVersionEvent.findMany({
        where,
        include: { ...eventInclude, module: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: events.map(toActivityItem), page, pageSize, total };
  }
}
