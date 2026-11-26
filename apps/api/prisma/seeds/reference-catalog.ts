/**
 * Mise en place du référentiel scout (D220), idempotente :
 * 1. import des contenus fournis comme brouillons (`REFERENCE_SOURCES`, aucune publication) ;
 * 2. rubriques de départ **seulement si absentes** (jamais modifiées ensuite : elles appartiennent
 *    au responsable) ;
 * 3. rangement des textes déjà présents (Prière de la Route, loi scoute) et des contenus importés,
 *    sans doublon. Un module absent est signalé, jamais créé.
 * Aucune rubrique « Chants », « Légendes » ou « Charte » n'est créée : ces contenus ne sont pas
 * encore fournis ; le responsable crée la rubrique depuis l'application le moment venu.
 */
import { type ReferenceAmbiance, type ReferenceIcon } from '@tesla/shared';
import { type PrismaClient } from '../../src/generated/prisma/client.js';
import { CEREMONIAL_SLUG, REFERENCE_SOURCES } from './referentiel-scout.seed.js';
import { type ImportResult, importSourceModules } from './source-modules.js';

interface DefaultCategory {
  slug: string;
  title: string;
  ambiance: ReferenceAmbiance;
  icon: ReferenceIcon;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { slug: 'ceremonies', title: 'Cérémonies', ambiance: 'SOLENNEL', icon: 'flamme' },
  { slug: 'prieres', title: 'Prières', ambiance: 'RECUEILLI', icon: 'coeur' },
  {
    slug: 'textes-de-reference',
    title: 'Textes de référence',
    ambiance: 'DOCUMENTAIRE',
    icon: 'parchemin',
  },
];

/** Rangements de départ : rubrique, module (slug) et, le cas échéant, titre de la leçon visée. */
export const DEFAULT_PLACEMENTS: readonly {
  category: string;
  module: string;
  lessonTitle: string | null;
}[] = [
  { category: 'ceremonies', module: CEREMONIAL_SLUG, lessonTitle: null },
  { category: 'prieres', module: 'priere-scoute', lessonTitle: null },
  { category: 'prieres', module: 'priere-de-la-route', lessonTitle: null },
  {
    category: 'textes-de-reference',
    module: 'nt-scout-m02-loi-principes-et-vertus',
    lessonTitle: 'Les dix articles de la loi scoute',
  },
];

export interface ReferenceSeedReport {
  imports: ImportResult[];
  categories: { slug: string; outcome: 'CREEE' | 'EXISTANTE' | 'A_CREER' }[];
  placements: {
    category: string;
    module: string;
    outcome: 'RANGE' | 'DEJA_RANGE' | 'A_RANGER' | 'MODULE_ABSENT' | 'LECON_ABSENTE';
  }[];
}

export async function seedReference(
  prisma: PrismaClient,
  { dryRun = false } = {},
): Promise<ReferenceSeedReport> {
  const imports = await importSourceModules(prisma, REFERENCE_SOURCES, { dryRun });
  const report: ReferenceSeedReport = { imports, categories: [], placements: [] };
  const categoryIds = new Map<string, string>();
  for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
    const existing = await prisma.referenceCategory.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });
    if (existing) {
      categoryIds.set(category.slug, existing.id);
      report.categories.push({ slug: category.slug, outcome: 'EXISTANTE' });
      continue;
    }
    if (dryRun) {
      report.categories.push({ slug: category.slug, outcome: 'A_CREER' });
      continue;
    }
    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.referenceCategory.aggregate({ _max: { position: true } });
      const row = await tx.referenceCategory.create({
        data: {
          slug: category.slug,
          title: category.title,
          ambiance: category.ambiance,
          icon: category.icon,
          position: Math.max((last._max.position ?? -1) + 1, index),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'reference.category_created',
          entityType: 'ReferenceCategory',
          entityId: row.id,
          metadata: { title: row.title, origin: 'seed' },
        },
      });
      return row;
    });
    categoryIds.set(category.slug, created.id);
    report.categories.push({ slug: category.slug, outcome: 'CREEE' });
  }

  for (const placement of DEFAULT_PLACEMENTS) {
    const outcome = await place(prisma, placement, categoryIds.get(placement.category), dryRun);
    report.placements.push({ category: placement.category, module: placement.module, outcome });
  }
  return report;
}

async function place(
  prisma: PrismaClient,
  placement: (typeof DEFAULT_PLACEMENTS)[number],
  categoryId: string | undefined,
  dryRun: boolean,
): Promise<ReferenceSeedReport['placements'][number]['outcome']> {
  const module = await prisma.pedagogicalModule.findUnique({
    where: { slug: placement.module },
    select: {
      id: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { lessons: { select: { title: true, lessonKey: true } } },
      },
    },
  });
  if (!module) return 'MODULE_ABSENT';
  let lessonKey: string | null = null;
  if (placement.lessonTitle) {
    const lesson = module.versions[0]?.lessons.find((row) => row.title === placement.lessonTitle);
    if (!lesson) return 'LECON_ABSENTE';
    lessonKey = lesson.lessonKey;
  }
  if (!categoryId) return 'A_RANGER';
  const existing = await prisma.referenceEntry.findFirst({
    where: { categoryId, moduleId: module.id, lessonKey },
    select: { id: true },
  });
  if (existing) return 'DEJA_RANGE';
  if (dryRun) return 'A_RANGER';
  await prisma.$transaction(async (tx) => {
    const last = await tx.referenceEntry.aggregate({
      where: { categoryId },
      _max: { position: true },
    });
    const row = await tx.referenceEntry.create({
      data: {
        categoryId,
        moduleId: module.id,
        lessonKey,
        position: (last._max.position ?? -1) + 1,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'reference.entry_added',
        entityType: 'ReferenceEntry',
        entityId: row.id,
        metadata: { categoryId, moduleId: module.id, lessonKey, origin: 'seed' },
      },
    });
  });
  return 'RANGE';
}

export function formatReferenceReport(report: ReferenceSeedReport, dryRun = false): string {
  const lines = [
    dryRun ? 'Référentiel scout — prévisualisation (aucune écriture)' : 'Référentiel scout',
  ];
  for (const result of report.imports) lines.push(`  module ${result.key} : ${result.outcome}`);
  for (const category of report.categories) {
    lines.push(`  rubrique ${category.slug} : ${category.outcome}`);
  }
  for (const placement of report.placements) {
    lines.push(`  ${placement.module} → ${placement.category} : ${placement.outcome}`);
  }
  lines.push(
    'Publication : par le responsable plein, depuis l’application (aucune publication automatique).',
  );
  return lines.join('\n');
}
