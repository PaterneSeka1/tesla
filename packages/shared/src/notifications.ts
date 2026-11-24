import { z } from 'zod';
import { compareCivilDates, daysBetween } from './age-progression.js';

// Notifications de la plateforme et rappels de rattrapage (D192). Voir docs/FEATURES/RATTRAPAGE.md.

/** Synchronisé avec l'enum Prisma `NotificationKind`. */
export const NOTIFICATION_KINDS = ['RATTRAPAGE_ECHEANCE_PROCHE', 'RATTRAPAGE_EN_RETARD'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Natures des rappels de rattrapage (toutes les notifications, à ce stade). */
export type CatchUpReminderKind = NotificationKind;

export const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({ items: z.array(notificationSchema) });

export type NotificationList = z.infer<typeof notificationListSchema>;

export const markNotificationsReadInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInputSchema>;

export const markNotificationsReadResultSchema = z.object({ updated: z.number().int() });

/**
 * Rappel dû pour une étape à rattraper (calcul pur) : « en retard » dès le lendemain de l'échéance ;
 * « échéance proche » de `alertDays` jours avant l'échéance jusqu'à elle (bornes incluses), seulement
 * si la fenêtre est arbitrée. Aucun rappel sans échéance validée.
 */
export function catchUpReminderKind(
  dueOn: string | null,
  today: string,
  alertDays: number | null | undefined,
): CatchUpReminderKind | null {
  if (dueOn === null) return null;
  if (compareCivilDates(dueOn, today) < 0) return 'RATTRAPAGE_EN_RETARD';
  if (alertDays != null && alertDays > 0 && daysBetween(today, dueOn) <= alertDays) {
    return 'RATTRAPAGE_ECHEANCE_PROCHE';
  }
  return null;
}

/** Date civile lisible « 14 décembre 2026 » (sans fuseau : date civile d'Abidjan). */
export function formatCivilDateFr(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
