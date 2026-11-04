import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type DeleteDraftInput,
  deleteDraftInputSchema,
  type DeleteDraftResult,
  type DraftDeletionBlocker,
  type DraftDeletionCheck,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isForeignKeyViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  formatModuleCode,
  isWorkingStatus,
  moduleNotFound,
  resolveAccess,
} from './module-common.js';

const BLOCKER_MESSAGES: Record<DraftDeletionBlocker, string> = {
  NO_DRAFT:
    'Aucun brouillon en cours de rédaction : une version soumise ou approuvée attend la décision du responsable, une version publiée s’archive.',
  SUBMITTED:
    'Ce brouillon a déjà été soumis : l’historique des décisions du responsable est conservé.',
  NOT_ALLOWED: 'Seuls l’auteur du brouillon et le responsable plein peuvent le supprimer.',
  IMPORTED:
    'Module issu de l’import du catalogue : sa provenance est conservée. Un brouillon vide peut être purgé par le responsable.',
  COLLABORATORS:
    'Des collaborateurs ont été associés à ce module : leur participation est conservée.',
  FILES: 'Des fichiers ont été téléversés pour ce module : ils sont conservés.',
  EVALUATIONS: 'Un questionnaire est rattaché à ce module.',
  USAGE:
    'Ce contenu est déjà utilisé (études, activités, compétences, rattrapages ou version dérivée).',
  CITED: 'Ce module est cité comme texte fondamental par un autre module.',
};

const inspectSelect = {
  number: true,
  createdById: true,
  publishedVersion: { select: { version: true } },
  sourceImport: { select: { id: true } },
  versions: {
    select: {
      id: true,
      version: true,
      status: true,
      title: true,
      submittedAt: true,
      createdById: true,
      _count: {
        select: {
          lessons: true,
          resources: true,
          derivedVersions: true,
          studies: true,
          evaluationVersions: true,
        },
      },
    },
    orderBy: { version: 'desc' },
  },
  _count: {
    select: {
      collaborators: true,
      files: true,
      evaluations: true,
      studies: true,
      activities: true,
      competencies: true,
      catchUps: true,
      citedBy: true,
    },
  },
} as const satisfies Prisma.PedagogicalModuleSelect;

/**
 * Suppression individuelle d'un brouillon jamais soumis (D171) : module jamais publié supprimé
 * avec ses leçons, ou version de travail d'un module publié abandonnée (le module et sa version
 * publiée restent intacts). Une seule cible par appel, jamais de lot ; contrôles refaits par la
 * fonction SQL `delete_module_draft` dans la même transaction ; journal d'audit écrit avec.
 */
@Injectable()
export class ModuleDraftDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Diagnostic présenté avant confirmation (lecture seule). */
  async check(actor: Actor, moduleId: string): Promise<DraftDeletionCheck> {
    assertCan(actor, 'module.write');
    return this.inspect(this.prisma, actor, moduleId);
  }

  async delete(
    actor: Actor,
    moduleId: string,
    input: DeleteDraftInput,
  ): Promise<DeleteDraftResult> {
    assertCan(actor, 'module.write');
    const { versionId } = parseInput(deleteDraftInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verrou du module : une seconde demande concurrente attend puis constate la suppression.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM pedagogical_modules WHERE id = ${moduleId}::uuid FOR UPDATE`;
        if (locked.length === 0) throw moduleNotFound();
        const check = await this.inspect(tx, actor, moduleId);
        if (!check.kind) throw notDeletable(check.blockers[0]?.message);
        if (check.versionId !== versionId) throw draftChanged();
        const [blocker] = check.blockers;
        if (blocker?.code === 'NOT_ALLOWED') {
          throw new ForbiddenException({ code: 'FORBIDDEN', message: blocker.message });
        }
        if (blocker || !check.kind) throw notDeletable(blocker?.message);
        const rows = await tx.$queryRaw<{ kind: string }[]>`
          SELECT delete_module_draft(${moduleId}::uuid, ${versionId}::uuid) AS kind`;
        const kind = rows[0]?.kind === 'MODULE' ? 'MODULE' : 'VERSION';
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: kind === 'MODULE' ? 'module.draft_deleted' : 'module.draft_version_discarded',
            entityType: 'PedagogicalModule',
            entityId: moduleId,
            metadata: {
              code: check.code,
              versionId,
              version: check.version,
              title: check.title,
              lessonCount: check.lessonCount,
              resourceCount: check.resourceCount,
              publishedVersion: check.publishedVersion,
            },
          },
        });
        return { kind, moduleId, versionId };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const text = String(error);
      if (text.includes('MODULE_NOT_FOUND')) throw moduleNotFound();
      if (text.includes('DRAFT_NOT_DELETABLE') || isForeignKeyViolation(error)) {
        throw notDeletable();
      }
      throw error;
    }
  }

  private async inspect(
    client: Prisma.TransactionClient,
    actor: Actor,
    moduleId: string,
  ): Promise<DraftDeletionCheck> {
    await resolveAccess(client, actor, moduleId); // 404 si le module n'est pas accessible
    const module = await client.pedagogicalModule.findUnique({
      where: { id: moduleId },
      select: inspectSelect,
    });
    if (!module) throw moduleNotFound();
    const working = module.versions.find((version) => isWorkingStatus(version.status));
    const shown = working ?? module.versions[0]!;
    const blockers: DraftDeletionBlocker[] = [];
    let kind: DraftDeletionCheck['kind'] = null;
    if (!working || working.status !== 'BROUILLON') blockers.push('NO_DRAFT');
    else if (working.submittedAt) blockers.push('SUBMITTED');
    else {
      kind = module.versions.length === 1 ? 'MODULE' : 'VERSION';
      const owner = kind === 'MODULE' ? module.createdById : working.createdById;
      if (!can(actor, 'module.review') && (owner === null || owner !== actor.userId)) {
        blockers.push('NOT_ALLOWED');
      }
      const counts = working._count;
      if (counts.derivedVersions + counts.studies + counts.evaluationVersions > 0) {
        blockers.push('USAGE');
      }
      if (kind === 'MODULE') {
        const refs = module._count;
        if (module.sourceImport) blockers.push('IMPORTED');
        if (refs.collaborators > 0) blockers.push('COLLABORATORS');
        if (refs.files > 0) blockers.push('FILES');
        if (refs.evaluations > 0) blockers.push('EVALUATIONS');
        if (refs.studies + refs.activities + refs.competencies + refs.catchUps > 0) {
          if (!blockers.includes('USAGE')) blockers.push('USAGE');
        }
        if (refs.citedBy > 0) blockers.push('CITED');
      }
    }
    return {
      moduleId,
      code: formatModuleCode(module.number),
      kind,
      versionId: working?.id ?? null,
      version: working?.version ?? null,
      title: shown.title,
      status: working?.status ?? null,
      lessonCount: working?._count.lessons ?? 0,
      resourceCount: working?._count.resources ?? 0,
      publishedVersion: module.publishedVersion?.version ?? null,
      allowed: kind !== null && blockers.length === 0,
      blockers: blockers.map((code) => ({ code, message: BLOCKER_MESSAGES[code] })),
    };
  }
}

function draftChanged(): ConflictException {
  return new ConflictException({
    code: 'DRAFT_CHANGED',
    message: 'Ce brouillon a changé ou a déjà été supprimé. Actualisez la liste.',
  });
}

function notDeletable(message?: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'DRAFT_NOT_DELETABLE',
    message: message ?? 'Ce brouillon ne peut pas être supprimé : des données en dépendent.',
  });
}
