import { Injectable } from '@nestjs/common';
import { type CatchUpReminderKind, catchUpReminderKind, formatCivilDateFr } from '@tesla/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  type NotificationDraft,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { todayCivil } from './age-rules.js';
import { loadCatchUpLock } from './catch-up-lock.js';
import { loadStageContext } from './computed-stage.js';

const TITLES: Record<CatchUpReminderKind, string> = {
  RATTRAPAGE_ECHEANCE_PROCHE: 'Rattrapage : échéance proche',
  RATTRAPAGE_EN_RETARD: 'Rattrapage en retard',
};

/**
 * Rappels de rattrapage (D192), par le traitement quotidien. Pour chaque routier actif retenu par le
 * verrou D177, l'étape en rattrapage et son échéance (le même calcul que le bandeau du routier)
 * donnent au plus un rappel « échéance proche » (fenêtre `catchUpAlertDays` du référentiel, nulle =
 * aucun) et un rappel « en retard ». Destinataires : le routier s'il a un compte actif, et le
 * responsable plein en fonction. Idempotent : une notification par destinataire, routier, étape,
 * échéance et nature. Le routier reçoit un message sans règle interne (D176).
 */
@Injectable()
export class CatchUpRemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatch(today: string = todayCivil()): Promise<{ created: number }> {
    const context = await loadStageContext(this.prisma, today);
    const alertDays = context.ruleSet?.catchUpAlertDays ?? null;
    const [profiles, plein] = await Promise.all([
      this.prisma.scoutProfile.findMany({
        where: {
          kind: 'ROUTIER',
          isActive: true,
          membershipStatus: 'ACTIF',
          // Seuls les routiers ayant une obligation sans décision avec échéance peuvent être relancés.
          catchUpObligations: { some: { decision: null, dueOn: { not: null } } },
        },
        select: {
          id: true,
          birthDate: true,
          membershipStatus: true,
          firstName: true,
          lastName: true,
          user: { select: { id: true, isActive: true, role: true } },
        },
      }),
      this.prisma.leadershipAssignment.findFirst({
        where: { function: 'PLEIN', endedAt: null, user: { isActive: true } },
        select: { userId: true },
      }),
    ]);
    const drafts: NotificationDraft[] = [];
    for (const profile of profiles) {
      const lock = await loadCatchUpLock(this.prisma, profile, context);
      if (!lock.active || !lock.stage) continue;
      const kind = catchUpReminderKind(lock.dueOn, today, alertDays);
      if (!kind || !lock.dueOn) continue;
      const due = formatCivilDateFr(lock.dueOn);
      const dedupeKey = `rattrapage:${profile.id}:${lock.stage.id}:${lock.dueOn}:${kind}`;
      if (profile.user?.isActive && profile.user.role === 'ROUTIER') {
        drafts.push({
          userId: profile.user.id,
          kind,
          title: TITLES[kind],
          body:
            kind === 'RATTRAPAGE_EN_RETARD'
              ? `L’échéance du rattrapage de l’étape ${lock.stage.name} (${due}) est dépassée. Parlez-en avec votre responsable.`
              : `Les modules à rattraper de l’étape ${lock.stage.name} sont à terminer avant le ${due}.`,
          link: '/mes-rattrapages',
          dedupeKey,
        });
      }
      if (plein) {
        const name = `${profile.firstName} ${profile.lastName}`;
        drafts.push({
          userId: plein.userId,
          kind,
          title: TITLES[kind],
          body:
            kind === 'RATTRAPAGE_EN_RETARD'
              ? `${name} : échéance du rattrapage de l’étape ${lock.stage.name} dépassée (${due}).`
              : `${name} : rattrapage de l’étape ${lock.stage.name} à terminer avant le ${due}.`,
          link: `/administration/routiers/${profile.id}`,
          dedupeKey,
        });
      }
    }
    return { created: await this.notifications.createMany(drafts) };
  }
}
