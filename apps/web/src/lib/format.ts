const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Abidjan',
});

/** Date calendaire (AAAA-MM-JJ) ou ISO, affichée en français : « 1 octobre 2026 ». */
export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

/** Horodatage affiché à l'heure d'Abidjan (UTC+0). */
export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.lastName.toUpperCase()} ${person.firstName}`;
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
