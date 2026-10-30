/**
 * Mise en service du catalogue importé (décision du responsable, 2026-10-30, D129–D130) :
 * - brouillon importé vide → suppression définitive (`purge_empty_module_draft`) ;
 * - brouillon importé avec contenu → leçons vides retirées, puis soumission, approbation et
 *   publication ;
 * - module publié → questionnaire d'entraînement créé, soumis, approuvé et publié (s'il n'en a pas).
 *
 * Toutes les écritures passent par les services de l'API, au nom d'une personne habilitée (responsable
 * plein en exercice ou délégation) : mêmes contrôles, même historique, même journal d'audit qu'à
 * l'écran. Idempotent : un module déjà publié ou un questionnaire déjà présent n'est pas retouché ; une
 * exécution interrompue reprend là où elle s'est arrêtée. Aucun module créé dans la plateforme (sans
 * provenance d'import) n'est concerné.
 */
import { type Actor } from '../../src/common/actor.js';
import { can } from '../../src/common/permissions.js';
import { type PrismaClient } from '../../src/generated/prisma/client.js';
import { resolveAuthority } from '../../src/modules/auth/auth.service.js';
import { EvaluationEditorService } from '../../src/modules/evaluations/evaluation-editor.service.js';
import { EvaluationReviewService } from '../../src/modules/evaluations/evaluation-review.service.js';
import {
  emptyDraftOf,
  isWorkingStatus,
  toLessonDocument,
} from '../../src/modules/pedagogy/module-common.js';
import { ModuleEditorService } from '../../src/modules/pedagogy/module-editor.service.js';
import { ModuleReviewService } from '../../src/modules/pedagogy/module-review.service.js';
import { type PrismaService } from '../../src/prisma/prisma.service.js';
import { isLessonDocumentEmpty } from '@tesla/shared';
import { QUIZ_INSTRUCTIONS, ROUTE_QUIZZES } from './route-questionnaires.js';

const DECISION = 'Mise en service du catalogue initial (décision du responsable, 2026-10-30).';
const PURGE_REASON =
  'Brouillon vide supprimé à la mise en service du catalogue (décision du responsable, 2026-10-30).';

const REQUIRED = [
  'module.write',
  'module.review',
  'evaluation.write',
  'evaluation.review',
] as const;

export interface ReleaseLine {
  key: string;
  outcome:
    | 'SUPPRIME'
    | 'PUBLIE'
    | 'DEJA_PUBLIE'
    | 'QUESTIONNAIRE_PUBLIE'
    | 'QUESTIONNAIRE_EXISTANT'
    | 'IGNORE';
  detail: string;
}

/**
 * Personne au nom de laquelle la mise en service est décidée : compte désigné par son e-mail, sinon
 * l'unique responsable plein en exercice. Ses habilitations sont recalculées comme pour une requête.
 */
export async function releaseActor(prisma: PrismaClient, email?: string): Promise<Actor> {
  let user: { id: string; role: string } | null;
  if (email) {
    user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
      select: { id: true, role: true },
    });
    if (!user) throw new Error('Aucun compte actif ne correspond à cette adresse.');
  } else {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const mandates = await prisma.leadershipMandate.findMany({
      where: {
        function: 'PLEIN',
        startsOn: { lte: today },
        OR: [{ endedEarlyOn: { gte: today } }, { endedEarlyOn: null, endsOn: { gte: today } }],
      },
      select: { user: { select: { id: true, role: true, isActive: true } } },
    });
    const active = mandates.filter((mandate) => mandate.user.isActive);
    if (active.length !== 1) {
      throw new Error(
        'Aucun responsable plein en exercice (ou plusieurs) : précisez le compte avec --acteur <e-mail>.',
      );
    }
    user = active[0]!.user;
  }
  const actor: Actor = {
    userId: user.id,
    ...(await resolveAuthority(prisma, user)),
  };
  const missing = REQUIRED.filter((permission) => !can(actor, permission));
  if (missing.length > 0) {
    throw new Error(`Habilitations insuffisantes pour la mise en service : ${missing.join(', ')}.`);
  }
  return actor;
}

export async function releaseCatalog(
  client: PrismaClient,
  actor: Actor,
  options: { dryRun?: boolean } = {},
): Promise<ReleaseLine[]> {
  const prisma = client as unknown as PrismaService;
  const dryRun = !!options.dryRun;
  const moduleEditor = new ModuleEditorService(prisma);
  const moduleReview = new ModuleReviewService(prisma, moduleEditor);
  const evaluationEditor = new EvaluationEditorService(prisma);
  const evaluationReview = new EvaluationReviewService(prisma, evaluationEditor);
  const lines: ReleaseLine[] = [];

  // ─── Modules importés ───────────────────────────────────────────────────
  const modules = await prisma.pedagogicalModule.findMany({
    where: { sourceImport: { isNot: null } },
    include: {
      sourceImport: { select: { sourceKey: true } },
      versions: {
        orderBy: { version: 'desc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
    },
    orderBy: { number: 'asc' },
  });
  for (const module of modules) {
    const key = module.sourceImport!.sourceKey;
    const working = module.versions.find((version) => isWorkingStatus(version.status));
    if (!working) {
      lines.push(
        module.publishedVersionId
          ? { key, outcome: 'DEJA_PUBLIE', detail: 'version publiée inchangée' }
          : { key, outcome: 'IGNORE', detail: 'aucune version de travail (archivé ou refusé)' },
      );
      continue;
    }
    if (module.publishedVersionId) {
      lines.push({
        key,
        outcome: 'IGNORE',
        detail: `version ${working.version} en cours de rédaction : publication laissée à l’encadrement`,
      });
      continue;
    }
    const draft = await emptyDraftOf(prisma, module.id);
    if (draft?.empty) {
      if (!dryRun) {
        await moduleReview.purgeEmptyDraft(actor, module.id, {
          versionId: working.id,
          comment: PURGE_REASON,
        });
      }
      lines.push({ key, outcome: 'SUPPRIME', detail: `« ${working.title} » (vide)` });
      continue;
    }
    if (working.status === 'A_CORRIGER') {
      lines.push({ key, outcome: 'IGNORE', detail: 'corrections demandées : à reprendre' });
      continue;
    }
    const emptyLessons = working.lessons.filter((lesson) =>
      isLessonDocumentEmpty(toLessonDocument(lesson.content)),
    );
    if (working.status === 'BROUILLON' && emptyLessons.length === working.lessons.length) {
      lines.push({ key, outcome: 'IGNORE', detail: 'aucune leçon rédigée' });
      continue;
    }
    if (!dryRun) {
      if (working.status === 'BROUILLON') {
        for (const lesson of emptyLessons) {
          await moduleEditor.deleteLesson(actor, lesson.id, lesson.revision);
        }
        const { revision } = await prisma.moduleVersion.findUniqueOrThrow({
          where: { id: working.id },
          select: { revision: true },
        });
        await moduleEditor.submit(actor, module.id, {
          versionId: working.id,
          revision,
          note: DECISION,
        });
      }
      if (working.status === 'BROUILLON' || working.status === 'SOUMIS') {
        await moduleReview.approve(actor, module.id, { versionId: working.id, comment: DECISION });
      }
      await moduleReview.publish(actor, module.id, { versionId: working.id });
    }
    const removed = working.status === 'BROUILLON' ? emptyLessons.length : 0;
    lines.push({
      key,
      outcome: 'PUBLIE',
      detail: `« ${working.title} », ${working.lessons.length - removed} leçon(s)${
        removed > 0 ? `, ${removed} leçon(s) vide(s) retirée(s)` : ''
      }`,
    });
  }

  // ─── Questionnaires d'entraînement ─────────────────────────────────────
  const published = new Set(
    lines
      .filter((line) => line.outcome === 'PUBLIE' || line.outcome === 'DEJA_PUBLIE')
      .map((l) => l.key),
  );
  for (const quiz of ROUTE_QUIZZES) {
    const key = `${quiz.moduleKey} (questionnaire)`;
    const source = await prisma.moduleSourceImport.findUnique({
      where: { sourceKey: quiz.moduleKey },
      select: {
        module: {
          select: {
            id: true,
            publishedVersionId: true,
            evaluations: { select: { id: true }, take: 1 },
            versions: {
              select: { title: true, stageId: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    const module = source?.module;
    if (!module || !published.has(quiz.moduleKey)) {
      lines.push({ key, outcome: 'IGNORE', detail: 'module absent ou non publié' });
      continue;
    }
    if (module.evaluations.length > 0) {
      lines.push({
        key,
        outcome: 'QUESTIONNAIRE_EXISTANT',
        detail: 'un questionnaire existe déjà',
      });
      continue;
    }
    const { title, stageId } = module.versions[0]!;
    if (!stageId) {
      lines.push({ key, outcome: 'IGNORE', detail: 'module sans étape recommandée' });
      continue;
    }
    if (!dryRun) {
      const created = await evaluationEditor.create(actor, {
        title: `Questionnaire — ${title}`.slice(0, 150),
        instructions: QUIZ_INSTRUCTIONS,
        stageId,
        moduleId: module.id,
      });
      const evaluationId = created.id;
      const versionId = created.current.id;
      let detail = created;
      for (const question of quiz.questions) {
        detail = await evaluationEditor.addQuestion(actor, evaluationId, {
          ...question,
          versionId,
        });
      }
      await evaluationEditor.submit(actor, evaluationId, {
        versionId,
        revision: detail.current.revision,
        note: DECISION,
      });
      await evaluationReview.approve(actor, evaluationId, { versionId, comment: DECISION });
      await evaluationReview.publish(actor, evaluationId, { versionId });
    }
    lines.push({
      key,
      outcome: 'QUESTIONNAIRE_PUBLIE',
      detail: `${quiz.questions.length} question(s), correction automatique`,
    });
  }
  return lines;
}

const LABELS: Record<ReleaseLine['outcome'], [string, string]> = {
  SUPPRIME: ['supprimé', 'serait supprimé'],
  PUBLIE: ['publié', 'serait publié'],
  DEJA_PUBLIE: ['déjà publié', 'déjà publié'],
  QUESTIONNAIRE_PUBLIE: ['questionnaire publié', 'questionnaire serait publié'],
  QUESTIONNAIRE_EXISTANT: ['questionnaire déjà présent', 'questionnaire déjà présent'],
  IGNORE: ['ignoré', 'serait ignoré'],
};

export function formatReleaseReport(lines: readonly ReleaseLine[], dryRun = false): string {
  return [
    `Mise en service du catalogue${dryRun ? ' (prévisualisation, aucune écriture)' : ''} :`,
    ...lines.map(
      (line) => `- ${line.key} : ${LABELS[line.outcome][dryRun ? 1 : 0]} — ${line.detail}.`,
    ),
  ].join('\n');
}
