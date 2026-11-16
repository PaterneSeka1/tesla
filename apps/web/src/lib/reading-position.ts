/** Position de lecture enregistrée sur cet appareil (coffre chiffré) pour un module. */
export interface ReadingPosition {
  lessonId: string;
  /** Absent des positions enregistrées avant D182. */
  lessonTitle?: string;
}

/**
 * Leçon à reprendre : par identifiant, sinon par titre. Une nouvelle version publiée recrée les
 * leçons (nouveaux identifiants) : le titre permet de retrouver la leçon, même déplacée (D182).
 */
export function resumeLesson<T extends { id: string; title: string }>(
  lessons: readonly T[],
  position: ReadingPosition | null,
): T | undefined {
  if (!position) return undefined;
  return (
    lessons.find((lesson) => lesson.id === position.lessonId) ??
    (position.lessonTitle
      ? lessons.find((lesson) => lesson.title === position.lessonTitle)
      : undefined)
  );
}
