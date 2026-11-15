import {
  isLessonDocumentEmpty,
  type LessonDocument,
  type ModuleVersionDetail,
} from '@tesla/shared';

/**
 * Vérification pédagogique avant soumission (refonte lots 1 et 2). Les points « bloquants »
 * reprennent exactement les refus du serveur (`MODULE_INCOMPLETE` : au moins une leçon, aucune
 * leçon vide) ou protègent une saisie non synchronisée ; les « conseils » ne bloquent jamais :
 * aucune obligation nouvelle n'est créée sans décision métier.
 */
export type ReadinessSection = 'presentation' | 'contenu';
export interface ReadinessItem {
  level: 'bloquant' | 'conseil';
  message: string;
  section: ReadinessSection;
  lessonId?: string;
}

function imagesWithoutAlt(doc: LessonDocument): number {
  let count = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; attrs?: { alt?: string | null }; content?: unknown[] };
    if (n.type === 'image' && !n.attrs?.alt?.trim()) count += 1;
    n.content?.forEach(walk);
  };
  walk(doc);
  return count;
}

export function moduleReadiness(
  version: Pick<ModuleVersionDetail, 'summary' | 'objectives' | 'stage' | 'lessons'>,
  unsyncedLessonIds: ReadonlySet<string> = new Set(),
): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  if (version.lessons.length === 0) {
    items.push({
      level: 'bloquant',
      message: 'Ajoutez au moins une leçon.',
      section: 'contenu',
    });
  }
  for (const lesson of version.lessons) {
    if (unsyncedLessonIds.has(lesson.id)) {
      items.push({
        level: 'bloquant',
        message: `La leçon « ${lesson.title} » a des modifications pas encore enregistrées sur le serveur.`,
        section: 'contenu',
        lessonId: lesson.id,
      });
    }
    if (isLessonDocumentEmpty(lesson.content)) {
      items.push({
        level: 'bloquant',
        message: `La leçon « ${lesson.title} » est vide.`,
        section: 'contenu',
        lessonId: lesson.id,
      });
    }
    const missingAlt = imagesWithoutAlt(lesson.content);
    if (missingAlt > 0) {
      items.push({
        level: 'conseil',
        message: `La leçon « ${lesson.title} » contient ${missingAlt === 1 ? 'une image' : `${missingAlt} images`} sans description.`,
        section: 'contenu',
        lessonId: lesson.id,
      });
    }
  }
  if (!version.summary.trim()) {
    items.push({
      level: 'conseil',
      message: 'Ajoutez une description du module.',
      section: 'presentation',
    });
  }
  if (version.objectives.length === 0) {
    items.push({
      level: 'conseil',
      message: 'Indiquez les objectifs pédagogiques.',
      section: 'presentation',
    });
  }
  if (!version.stage) {
    items.push({
      level: 'conseil',
      message: 'Précisez l’étape recommandée.',
      section: 'presentation',
    });
  }
  return items;
}
