/**
 * Brouillons locaux des leçons (enregistrement automatique, refonte lot 1). Filet de sécurité :
 * chaque saisie est copiée sur l'appareil avant d'être envoyée, puis retirée quand le serveur a
 * confirmé l'enregistrement. Le contenu d'une leçon est pédagogique (aucune donnée personnelle) ;
 * il reste sur l'appareil tant qu'il n'est pas confirmé, y compris après une déconnexion, pour ne
 * jamais perdre un travail non envoyé.
 */
export interface LessonDraft {
  lessonId: string;
  /** Révision du serveur sur laquelle repose la saisie (contrôle de concurrence optimiste). */
  baseRevision: number;
  title: string;
  duration: string;
  content: unknown;
  savedAt: number;
}

const PREFIX = 'tesla-lesson-draft:';
const key = (lessonId: string) => `${PREFIX}${lessonId}`;

export function readLessonDraft(lessonId: string): LessonDraft | null {
  try {
    const raw = localStorage.getItem(key(lessonId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LessonDraft;
    return draft.lessonId === lessonId && typeof draft.baseRevision === 'number' ? draft : null;
  } catch {
    return null;
  }
}

/** `false` : stockage indisponible ou plein (la saisie reste en mémoire, l'interface le signale). */
export function writeLessonDraft(draft: LessonDraft): boolean {
  try {
    localStorage.setItem(key(draft.lessonId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Retire le brouillon s'il n'a pas été modifié depuis `savedAt` (saisie plus récente conservée). */
export function clearLessonDraft(lessonId: string, upTo = Number.POSITIVE_INFINITY) {
  try {
    const draft = readLessonDraft(lessonId);
    if (draft && draft.savedAt <= upTo) localStorage.removeItem(key(lessonId));
  } catch {
    /* Stockage indisponible. */
  }
}

/** Même contenu que la version du serveur (brouillon déjà enregistré). */
export function sameLessonContent(
  a: { title: string; duration: string; content: unknown },
  b: { title: string; duration: string; content: unknown },
) {
  return (
    a.title.trim() === b.title.trim() &&
    a.duration.trim() === b.duration.trim() &&
    JSON.stringify(a.content) === JSON.stringify(b.content)
  );
}
