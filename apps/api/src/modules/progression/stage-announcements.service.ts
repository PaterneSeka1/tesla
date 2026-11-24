import { Injectable } from '@nestjs/common';
import { formatCivilDateFr, stageAnnouncementDue } from '@tesla/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  type NotificationDraft,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { todayCivil } from './age-rules.js';
import { computedStageOf, loadStageContext } from './computed-stage.js';

const TITLE = 'Nouvelle étape du parcours';

/**
 * Annonce du passage d'étape (D193), par le traitement quotidien. L'étape reste **calculée** (D173) :
 * rien n'est stocké hormis la notification. Pour chaque routier actif dont la période de l'étape
 * appliquée a commencé depuis au plus 7 jours (rattrapage d'un traitement manqué), une notification
 * au routier (compte actif) et au responsable plein en fonction, une seule fois par étape et date de
 * début. Jamais pendant une exception de secours, ni pour un routier sorti ou un apprenant adulte ;
 * jamais présentée comme une cérémonie, un engagement ou une validation (D176).
 */
@Injectable()
export class StageAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatch(today: string = todayCivil()): Promise<{ created: number }> {
    const context = await loadStageContext(this.prisma, today);
    if (!context.rules) return { created: 0 };
    const [profiles, plein] = await Promise.all([
      this.prisma.scoutProfile.findMany({
        where: { kind: 'ROUTIER', isActive: true, membershipStatus: 'ACTIF' },
        select: {
          id: true,
          kind: true,
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
      const computed = computedStageOf(profile, context);
      // Étape déterminée par l'âge seulement : une exception de secours n'est pas un passage.
      if (!computed.stage || computed.override || computed.reason !== 'REGLE') continue;
      const startsOn = computed.progression.period?.startsOn ?? null;
      if (!startsOn || !stageAnnouncementDue(startsOn, today)) continue;
      const since = formatCivilDateFr(startsOn);
      const dedupeKey = `etape:${profile.id}:${computed.stage.id}:${startsOn}`;
      if (profile.user?.isActive && profile.user.role === 'ROUTIER') {
        drafts.push({
          userId: profile.user.id,
          kind: 'ETAPE_NOUVELLE',
          title: TITLE,
          body: `Depuis le ${since}, vous êtes en ${computed.stage.name}. Les modules de cette étape vous attendent dans votre parcours.`,
          link: '/progression',
          dedupeKey,
        });
      }
      if (plein) {
        drafts.push({
          userId: plein.userId,
          kind: 'ETAPE_NOUVELLE',
          title: TITLE,
          body: `${profile.firstName} ${profile.lastName} est en ${computed.stage.name} depuis le ${since}.`,
          link: `/administration/routiers/${profile.id}`,
          dedupeKey,
        });
      }
    }
    return { created: await this.notifications.createMany(drafts) };
  }
}
