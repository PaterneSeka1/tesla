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
