const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Abidjan',
});
const monthFormatters = {
  short: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
};

/** Date calendaire (AAAA-MM-JJ) ou ISO, affichée en français : « 1 octobre 2026 ». */
export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

/** Mois (AAAA-MM) en français : « oct. 2026 » ou « octobre 2026 ». */
export function formatMonth(value: string, style: 'short' | 'long' = 'short'): string {
  return monthFormatters[style].format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
}

/** Taille de stockage lisible : « 1 Mo », « 10 Go » (base 1024, comme le navigateur). */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${Math.max(1, Math.ceil(mb))} Mo`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1).replace('.', ',').replace(',0', '') : Math.floor(gb)} Go`;
}

/** Horodatage affiché à l'heure d'Abidjan (UTC+0). */
export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.lastName.toUpperCase()} ${person.firstName}`;
}

/** Auteur d'un module ou d'une action ; null = création par le système (import d'une source). */
export function authorName(person: { firstName: string; lastName: string } | null): string {
  return person ? fullName(person) : 'Import système';
}

/** Ancienneté d'une attente en jours calendaires : « aujourd’hui », « depuis hier », « depuis 5 jours ». */
export function formatWaiting(since: string, now: Date = new Date()): string {
  const days = Math.floor(
    (Date.parse(now.toISOString().slice(0, 10)) - Date.parse(since.slice(0, 10))) / 86_400_000,
  );
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'depuis hier';
  return `depuis ${days} jours`;
}

/** Date du jour au format AAAA-MM-JJ (valeur par défaut des champs date). */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Durée indicative : 45 → « 45 min », 90 → « 1 h 30 ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

const pointsFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Barème ou note : 1 → « 1 pt », 2.5 → « 2,5 pts ». */
export function formatPoints(value: number): string {
  return `${pointsFormatter.format(value)} pt${value > 1 ? 's' : ''}`;
}

/** Score sur barème : « 6,5 / 8 ». */
export function formatScore(score: number | null, maxScore: number | null): string {
  if (score === null || maxScore === null) return '—';
  return `${pointsFormatter.format(score)} / ${pointsFormatter.format(maxScore)}`;
}
