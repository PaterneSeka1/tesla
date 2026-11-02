/**
 * Import système de modules pédagogiques depuis une source documentaire (seed).
 *
 * - Module absent : création en une transaction (module, version 1 BROUILLON, leçons, événement
 *   « créée » sans acteur humain, provenance, journal d'audit). Aucune approbation ni publication.
 * - Module déjà importé (même code source) : aucune écriture. Les écarts entre la source actuelle et
 *   l'instantané importé sont signalés, ainsi que les modifications faites depuis dans la plateforme.
 * - Révision (`applyRevisions`, option `--mettre-a-jour`) : la source modifiée est appliquée par le
 *   système au seul brouillon resté intact (version 1 jamais soumise, aucune écriture humaine, aucun
 *   questionnaire, ressource ou collaborateur). Une révision en ajout seul (`module_source_revisions`)
 *   conserve l'instantané, l'empreinte et les notes ; l'import d'origine est inchangé. Un module
 *   touché par une personne n'est jamais réécrit : ses écarts restent signalés.
 * - Mode prévisualisation (`dryRun`) : aucune écriture, même rapport.
 */
import { createHash } from 'node:crypto';
import {
  type LessonDocument,
  lessonDocumentSchema,
  type ModuleCategory,
  type SourceEditorialNote,
  sourceEditorialNoteSchema,
} from '@tesla/shared';
import { type Prisma, type PrismaClient } from '../../src/generated/prisma/client.js';

export interface SourceLesson {
  title: string;
  content: LessonDocument;
}

export interface SourceModule {
  /** Code stable de la source (ex. « NT-SCOUT-M01 ») : clé de réexécution. */
  key: string;
  /** Slug stable, fixé à l'import. */
  slug: string;
  title: string;
  summary: string;
  objectives: string[];
  /** Étape recommandée (proposition, jamais une condition de progression) ; null = toutes étapes. */
  stageCode: string | null;
  theme: string;
  /** Typologie (D99) ; absente pour les imports antérieurs (empreinte inchangée). */
  category?: ModuleCategory;
  sourceDocument: string;
  sourceSha256: string;
  sourcePages: string;
  lessons: SourceLesson[];
  /**
   * Textes fondamentaux cités (codes source d'autres modules importés) : liens, jamais une copie.
   * Absent pour les imports antérieurs (empreinte inchangée).
   */
  textLinks?: string[];
  /** Notes éditoriales : contenus à compléter, points à vérifier. Jamais transmises aux routiers. */
  notes: SourceEditorialNote[];
}

export type ImportResult =
  | { key: string; outcome: 'CREE'; moduleId: string; lessons: number }
  | { key: string; outcome: 'A_CREER'; lessons: number }
  | {
      key: string;
      /** Source modifiée appliquée au brouillon intact (`A_REVISER` en prévisualisation). */
      outcome: 'REVISE' | 'A_REVISER';
      moduleId: string;
      revision: number;
      differences: string[];
    }
  | {
      key: string;
      outcome: 'DEJA_IMPORTE';
      moduleId: string;
      /** Écarts entre la source actuelle et l'instantané importé (jamais appliqués). */
      differences: string[];
      /** Évolutions du module dans la plateforme depuis l'import (information). */
      changesSinceImport: string[];
      /** Écarts applicables par `--mettre-a-jour` (brouillon resté intact). */
      revisable?: boolean;
    }
  | { key: string; outcome: 'IGNORE'; reason: string };

/** Sérialisation à clés triées : l'empreinte ne dépend pas de l'ordre des clés (JSONB les réordonne). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, item]) => `${JSON.stringify(k)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Instantané conservé dans la provenance : tout ce que l'import a écrit. */
export function snapshotOf(source: SourceModule) {
  return {
    title: source.title,
    summary: source.summary,
    objectives: source.objectives,
    stageCode: source.stageCode,
    theme: source.theme,
    category: source.category,
    sourceSha256: source.sourceSha256,
    lessons: source.lessons.map((lesson) => ({ title: lesson.title, content: lesson.content })),
    notes: source.notes,
    textLinks: source.textLinks,
  };
}

type Snapshot = ReturnType<typeof snapshotOf>;

export function contentHash(source: SourceModule): string {
  return createHash('sha256')
    .update(canonicalJson(snapshotOf(source)))
    .digest('hex');
}

/** Refuse une définition invalide avant toute écriture (même liste blanche que l'API). */
export function assertValidSource(source: SourceModule): void {
  const problems: string[] = [];
  if (!/^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(source.key)) problems.push('code source invalide');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(source.slug)) problems.push('slug invalide');
  if (source.lessons.length === 0) problems.push('aucune leçon');
  source.lessons.forEach((lesson, index) => {
    if (!lesson.title.trim()) problems.push(`leçon ${index + 1} sans titre`);
    if (!lessonDocumentSchema.safeParse(lesson.content).success) {
      problems.push(`leçon ${index + 1} : contenu hors liste blanche`);
    }
  });
  source.notes.forEach((note, index) => {
    const valid = sourceEditorialNoteSchema.safeParse(note).success;
    if (!valid || (note.lessonPosition !== null && note.lessonPosition >= source.lessons.length)) {
      problems.push(`note ${index + 1} invalide`);
    }
  });
  if (problems.length > 0) {
    throw new Error(`Source ${source.key} refusée : ${problems.join(', ')}.`);
  }
}

/** Différences lisibles entre l'instantané importé et la source actuelle. */
export function diffSnapshots(imported: Snapshot, current: Snapshot): string[] {
  const differences: string[] = [];
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  const fields = [
    'title',
    'summary',
    'objectives',
    'stageCode',
    'theme',
    'category',
    'sourceSha256',
  ] as const;
  for (const field of fields) {
    if (!same(imported[field], current[field])) differences.push(`${field} modifié dans la source`);
  }
  const count = Math.max(imported.lessons.length, current.lessons.length);
  for (let index = 0; index < count; index += 1) {
    const before = imported.lessons[index];
    const after = current.lessons[index];
    const label = `leçon ${index + 1}`;
    if (!before) differences.push(`${label} ajoutée dans la source : « ${after!.title} »`);
    else if (!after) differences.push(`${label} retirée de la source : « ${before.title} »`);
    else {
      if (before.title !== after.title) {
        differences.push(`${label} : titre « ${before.title} » → « ${after.title} »`);
      }
      if (!same(before.content, after.content)) differences.push(`${label} : contenu modifié`);
    }
  }
  if (!same(imported.notes, current.notes)) differences.push('notes éditoriales modifiées');
  if (!same(imported.textLinks, current.textLinks)) differences.push('textes cités modifiés');
  return differences;
}

/** Évolutions du module depuis l'import, pour informer sans jamais les écraser. */
async function changesSinceImport(
  prisma: PrismaClient,
  moduleId: string,
  importedLessons: number,
): Promise<string[]> {
  const module = await prisma.pedagogicalModule.findUniqueOrThrow({
    where: { id: moduleId },
    include: {
      versions: {
        orderBy: { version: 'asc' },
        include: {
          lessons: { select: { revision: true, updatedById: true, createdById: true } },
        },
      },
    },
  });
  const changes: string[] = [];
  const first = module.versions[0]!;
  // Hors brouillon, l'état suffit : la soumission elle-même incrémente la révision.
  if (first.status !== 'BROUILLON') changes.push(`version 1 à l'état ${first.status}`);
  else if (first.updatedById !== null) {
    // La révision seule ne suffit pas : une révision de source l'incrémente sans auteur humain.
    changes.push('informations de la version 1 modifiées');
  }
  const editedLessons = first.lessons.filter(
    (l) => l.updatedById !== null || l.createdById !== null || l.revision > 1,
  );
  if (editedLessons.length > 0) changes.push(`${editedLessons.length} leçon(s) modifiée(s)`);
  if (first.lessons.length !== importedLessons) {
    changes.push(`${first.lessons.length} leçon(s) au lieu de ${importedLessons} importée(s)`);
  }
  if (module.versions.length > 1) changes.push(`${module.versions.length} versions`);
  if (module.publishedVersionId) {
    const published = module.versions.find((v) => v.id === module.publishedVersionId);
    changes.push(`version ${published?.version ?? '?'} publiée`);
  }
  return changes;
}

/** Dernier instantané appliqué : dernière révision de source, sinon l'import d'origine. */
async function currentProvenance(prisma: PrismaClient, moduleId: string) {
  const imported = await prisma.moduleSourceImport.findUniqueOrThrow({ where: { moduleId } });
  const latest = await prisma.moduleSourceRevision.findFirst({
    where: { moduleId },
    orderBy: { revision: 'desc' },
  });
  return {
    revision: latest?.revision ?? 1,
    contentHash: latest?.contentHash ?? imported.contentHash,
    snapshot: (latest?.importedContent ?? imported.importedContent) as unknown as Snapshot,
  };
}

/**
 * Vrai si aucune personne n'est intervenue sur le module : une seule version, en brouillon jamais
 * soumis, écrite par le système seul, sans ressource, collaborateur ni questionnaire.
 */
async function isUntouchedDraft(prisma: PrismaClient, moduleId: string): Promise<boolean> {
  const module = await prisma.pedagogicalModule.findUniqueOrThrow({
    where: { id: moduleId },
    include: {
      versions: { include: { lessons: true, resources: true, textLinks: true } },
      collaborators: { select: { id: true }, take: 1 },
      evaluations: { select: { id: true }, take: 1 },
    },
  });
  const [only] = module.versions;
  return (
    module.versions.length === 1 &&
    module.publishedVersionId === null &&
    module.createdById === null &&
    module.collaborators.length === 0 &&
    module.evaluations.length === 0 &&
    only!.status === 'BROUILLON' &&
    only!.submittedAt === null &&
    only!.createdById === null &&
    only!.updatedById === null &&
    only!.resources.length === 0 &&
    only!.textLinks.every((link) => link.createdById === null) &&
    only!.lessons.every((l) => l.createdById === null && l.updatedById === null && l.revision === 1)
  );
}

/** Applique la source au brouillon intact, en une transaction, au nom du système. */
async function reviseOne(
  prisma: PrismaClient,
  source: SourceModule,
  moduleId: string,
  revision: number,
  differences: string[],
): Promise<void> {
  const stage = source.stageCode
    ? await prisma.progressionStage.findUnique({ where: { code: source.stageCode } })
    : null;
  if (source.stageCode && !stage) throw new Error(`Étape « ${source.stageCode} » absente.`);
  const linked = await prisma.moduleSourceImport.findMany({
    where: { sourceKey: { in: source.textLinks ?? [] } },
    select: { sourceKey: true, moduleId: true },
  });
  if (linked.length !== (source.textLinks ?? []).length) {
    throw new Error(`Source ${source.key} : texte cité non importé.`);
  }
  await prisma.$transaction(async (tx) => {
    const version = await tx.moduleVersion.findFirstOrThrow({
      where: { moduleId, version: 1, status: 'BROUILLON', updatedById: null },
    });
    await tx.moduleVersion.update({
      where: { id: version.id },
      data: {
        title: source.title,
        summary: source.summary,
        objectives: source.objectives,
        stageId: stage?.id ?? null,
        theme: source.theme,
        category: source.category ?? null,
        // Contrôle de concurrence : un éditeur ouvert sur l'ancien contenu sera refusé.
        revision: { increment: 1 },
      },
    });
    // Les leçons système sont remplacées (brouillon jamais lu par un routier ni soumis).
    await tx.moduleLesson.deleteMany({ where: { versionId: version.id, createdById: null } });
    await tx.moduleLesson.createMany({
      data: source.lessons.map((lesson, position) => ({
        versionId: version.id,
        position,
        title: lesson.title,
        content: lesson.content as unknown as Prisma.InputJsonObject,
        createdById: null,
      })),
    });
    await tx.moduleTextLink.deleteMany({ where: { versionId: version.id, createdById: null } });
    if (source.textLinks && source.textLinks.length > 0) {
      await tx.moduleTextLink.createMany({
        data: source.textLinks.map((key, position) => ({
          versionId: version.id,
          textModuleId: linked.find((row) => row.sourceKey === key)!.moduleId,
          position,
          createdById: null,
        })),
      });
    }
    const hash = contentHash(source);
    await tx.moduleSourceRevision.create({
      data: {
        moduleId,
        revision,
        sourceSha256: source.sourceSha256,
        sourcePages: source.sourcePages,
        editorialNotes: source.notes,
        importedContent: snapshotOf(source) as unknown as Prisma.InputJsonObject,
        contentHash: hash,
        changes: differences,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'module.source_revised',
        entityType: 'PedagogicalModule',
        entityId: moduleId,
        metadata: { sourceKey: source.key, revision, contentHash: hash, changes: differences },
      },
    });
  });
}

async function importOne(
  prisma: PrismaClient,
  source: SourceModule,
  dryRun: boolean,
  applyRevisions: boolean,
): Promise<ImportResult> {
  const existing = await prisma.moduleSourceImport.findUnique({
    where: { sourceKey: source.key },
  });
  if (existing) {
    const current = await currentProvenance(prisma, existing.moduleId);
    const differences =
      current.contentHash === contentHash(source)
        ? []
        : diffSnapshots(current.snapshot, snapshotOf(source));
    const revisable = differences.length > 0 && (await isUntouchedDraft(prisma, existing.moduleId));
    if (revisable && applyRevisions) {
      const revision = current.revision + 1;
      if (!dryRun) {
        await reviseOne(prisma, source, existing.moduleId, revision, differences);
      }
      return {
        key: source.key,
        outcome: dryRun ? 'A_REVISER' : 'REVISE',
        moduleId: existing.moduleId,
        revision,
        differences,
      };
    }
    return {
      key: source.key,
      outcome: 'DEJA_IMPORTE',
      moduleId: existing.moduleId,
      differences,
      changesSinceImport: await changesSinceImport(
        prisma,
        existing.moduleId,
        current.snapshot.lessons.length,
      ),
      revisable,
    };
  }
  const slugTaken = await prisma.pedagogicalModule.findUnique({ where: { slug: source.slug } });
  if (slugTaken) {
    return {
      key: source.key,
      outcome: 'IGNORE',
      reason: `l'adresse « ${source.slug} » est déjà utilisée par un autre module`,
    };
  }
  const stage = source.stageCode
    ? await prisma.progressionStage.findUnique({ where: { code: source.stageCode } })
    : null;
  if (source.stageCode && !stage) {
    throw new Error(
      `Étape « ${source.stageCode} » absente : exécutez d'abord le seed principal (npm run db:seed).`,
    );
  }
  // Textes cités : importés auparavant (même exécution ou exécution antérieure).
  const linked = await prisma.moduleSourceImport.findMany({
    where: { sourceKey: { in: source.textLinks ?? [] } },
    select: { sourceKey: true, moduleId: true },
  });
  const missing = (source.textLinks ?? []).filter(
    (key) => !linked.some((row) => row.sourceKey === key),
  );
  if (missing.length > 0 && !dryRun) {
    return {
      key: source.key,
      outcome: 'IGNORE',
      reason: `texte(s) cité(s) non importé(s) : ${missing.join(', ')}`,
    };
  }
  if (dryRun) return { key: source.key, outcome: 'A_CREER', lessons: source.lessons.length };

  try {
    const moduleId = await prisma.$transaction(async (tx) => {
      // Auteur nul : création par le système, jamais attribuée à un chef ou au responsable.
      const module = await tx.pedagogicalModule.create({
        data: { slug: source.slug, createdById: null },
      });
      const version = await tx.moduleVersion.create({
        data: {
          moduleId: module.id,
          version: 1,
          title: source.title,
          summary: source.summary,
          objectives: source.objectives,
          stageId: stage?.id ?? null,
          theme: source.theme,
          category: source.category ?? null,
          createdById: null,
        },
      });
      await tx.moduleLesson.createMany({
        data: source.lessons.map((lesson, position) => ({
          versionId: version.id,
          position,
          title: lesson.title,
          content: lesson.content as unknown as Prisma.InputJsonObject,
          createdById: null,
        })),
      });
      if (source.textLinks && source.textLinks.length > 0) {
        await tx.moduleTextLink.createMany({
          data: source.textLinks.map((key, position) => ({
            versionId: version.id,
            textModuleId: linked.find((row) => row.sourceKey === key)!.moduleId,
            position,
            createdById: null,
          })),
        });
      }
      await tx.moduleVersionEvent.create({
        data: {
          moduleId: module.id,
          versionId: version.id,
          actorId: null,
          action: 'CREEE',
          fromStatus: null,
          toStatus: 'BROUILLON',
          comment: `Import système : ${source.sourceDocument}, ${source.sourcePages} (${source.key}).`,
        },
      });
      const hash = contentHash(source);
      await tx.moduleSourceImport.create({
        data: {
          moduleId: module.id,
          sourceKey: source.key,
          sourceDocument: source.sourceDocument,
          sourceSha256: source.sourceSha256,
          sourcePages: source.sourcePages,
          editorialNotes: source.notes,
          importedContent: snapshotOf(source) as unknown as Prisma.InputJsonObject,
          contentHash: hash,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'module.imported',
          entityType: 'PedagogicalModule',
          entityId: module.id,
          metadata: {
            sourceKey: source.key,
            sourceDocument: source.sourceDocument,
            sourceSha256: source.sourceSha256,
            contentHash: hash,
          },
        },
      });
      return module.id;
    });
    return { key: source.key, outcome: 'CREE', moduleId, lessons: source.lessons.length };
  } catch (error) {
    // Exécution concurrente : l'autre import a créé le module (code source ou slug unique).
    if ((error as { code?: string }).code === 'P2002') {
      return {
        key: source.key,
        outcome: 'IGNORE',
        reason: 'importé entre-temps par une autre exécution',
      };
    }
    throw error;
  }
}

/** Importe les modules dans l'ordre ; chaque module est indépendant (une transaction chacun). */
export async function importSourceModules(
  prisma: PrismaClient,
  sources: readonly SourceModule[],
  /** `applyRevisions` : appliquer la source modifiée aux brouillons restés intacts. */
  options: { dryRun?: boolean; applyRevisions?: boolean } = {},
): Promise<ImportResult[]> {
  const keys = new Set(sources.map((source) => source.key));
  const slugs = new Set(sources.map((source) => source.slug));
  if (keys.size !== sources.length || slugs.size !== sources.length) {
    throw new Error('Codes source ou slugs en double dans la définition des modules.');
  }
  sources.forEach(assertValidSource);
  const results: ImportResult[] = [];
  for (const source of sources) {
    results.push(await importOne(prisma, source, !!options.dryRun, !!options.applyRevisions));
  }
  return results;
}

/** Rapport lisible (console). */
export function formatImportReport(results: readonly ImportResult[], dryRun = false): string {
  const lines = [
    `Modules pédagogiques importés${dryRun ? ' (prévisualisation, aucune écriture)' : ''} :`,
  ];
  for (const result of results) {
    switch (result.outcome) {
      case 'CREE':
        lines.push(`- ${result.key} : créé en brouillon (${result.lessons} leçons).`);
        break;
      case 'A_CREER':
        lines.push(`- ${result.key} : serait créé en brouillon (${result.lessons} leçons).`);
        break;
      case 'REVISE':
      case 'A_REVISER':
        lines.push(
          `- ${result.key} : brouillon intact ${
            result.outcome === 'REVISE' ? 'mis à jour' : 'serait mis à jour'
          } (révision ${result.revision} de la source).`,
        );
        lines.push(...result.differences.map((d) => `    · ${d}`));
        break;
      case 'IGNORE':
        lines.push(`- ${result.key} : ignoré, ${result.reason}.`);
        break;
      case 'DEJA_IMPORTE':
        lines.push(`- ${result.key} : déjà importé, aucune modification appliquée.`);
        if (result.differences.length > 0) {
          lines.push(
            result.revisable
              ? '  Écarts applicables au brouillon intact (relancer avec --mettre-a-jour) :'
              : '  Écarts entre la source et l’import (à reporter manuellement si utile) :',
          );
          lines.push(...result.differences.map((d) => `    · ${d}`));
        }
        if (result.changesSinceImport.length > 0) {
          lines.push(`  Évolutions depuis l’import : ${result.changesSinceImport.join(' ; ')}.`);
        }
        break;
    }
  }
  return lines.join('\n');
}
