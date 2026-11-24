/**
 * Préférences de lecture de cet appareil (aucune donnée personnelle) : mode préféré et séquence
 * en cours par leçon, pour reprendre exactement là où l'on s'était arrêté (D195).
 */
const MODE_KEY = 'tesla.reader.mode';
const SECTION_KEY = 'tesla.reader.sections';
const MAX_LESSONS = 50;

export type ReaderMode = 'decouverte' | 'integrale';

export function readerMode(): ReaderMode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'integrale' ? 'integrale' : 'decouverte';
  } catch {
    return 'decouverte';
  }
}

export function saveReaderMode(mode: ReaderMode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Stockage indisponible : préférence non conservée.
  }
}

function sections(): Record<string, number> {
  try {
    const value = JSON.parse(window.localStorage.getItem(SECTION_KEY) ?? '{}') as unknown;
    return value && typeof value === 'object' ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function readerSection(lessonId: string): number {
  const value = sections()[lessonId];
  return typeof value === 'number' && value >= 0 ? value : 0;
}

export function saveReaderSection(lessonId: string, section: number) {
  try {
    const current = sections();
    delete current[lessonId];
    // Les plus récentes en dernier ; on n'en garde qu'un nombre limité.
    const entries = [...Object.entries(current), [lessonId, section] as const].slice(-MAX_LESSONS);
    window.localStorage.setItem(SECTION_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Stockage indisponible.
  }
}
