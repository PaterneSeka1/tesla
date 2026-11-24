import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  markNotificationsReadInputSchema,
  type NotificationKind,
  type NotificationList,
} from '@tesla/shared';
import { type Transporter } from 'nodemailer';
import { type Actor } from '../../common/actor.js';
import { createMailTransport, smtpErrorCode } from '../../common/mail-transport.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Notification à créer (idempotente par destinataire et `dedupeKey`). */
export interface NotificationDraft {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Chemin interne de l'application, jamais une URL externe. */
  link: string | null;
  dedupeKey: string;
}

/** Au-delà, une notification non envoyée n'est plus expédiée par e-mail (seulement affichée). */
const EMAIL_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const UNREAD_LIMIT = 50;

/**
 * Notifications personnelles (D192) : création idempotente, lecture et accusé de lecture par le
 * titulaire seul, envoi par e-mail au plus une fois (réservation `email_attempted_at`), facultatif
 * (D166). Ni le contenu ni l'adresse ne sont journalisés.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transport: Transporter | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.transport = createMailTransport(env);
  }

  /** Notifications non lues du compte connecté, plus récentes d'abord. */
  async listMine(actor: Actor): Promise<NotificationList> {
    assertCan(actor, 'notification.own');
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.userId, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: UNREAD_LIMIT,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        link: row.link,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
    };
  }

  /** Accusé de lecture : seulement ses propres notifications ; une seconde lecture est sans effet. */
  async markRead(actor: Actor, input: unknown): Promise<{ updated: number }> {
    assertCan(actor, 'notification.own');
    const { ids } = parseInput(markNotificationsReadInputSchema, input);
    const { count } = await this.prisma.notification.updateMany({
      where: { id: { in: ids }, userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  /** Création idempotente ; renvoie le nombre de notifications réellement créées. */
  async createMany(drafts: readonly NotificationDraft[]): Promise<number> {
    if (drafts.length === 0) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: drafts.map((draft) => ({ ...draft })),
      skipDuplicates: true,
    });
    return count;
  }

  /**
   * Envoie par e-mail les notifications récentes jamais tentées, aux comptes actifs. Chaque envoi
   * est réservé avant l'expédition : un traitement relancé ou concurrent n'envoie jamais deux fois ;
   * un échec n'est pas retenté (la notification reste affichée dans l'application).
   */
  async deliverEmails(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
    if (!this.transport) return { sent: 0, failed: 0 };
    const pending = await this.prisma.notification.findMany({
      where: {
        emailAttemptedAt: null,
        readAt: null,
        createdAt: { gte: new Date(now.getTime() - EMAIL_MAX_AGE_MS) },
        user: { isActive: true },
      },
      include: { user: { select: { email: true, firstName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    let sent = 0;
    let failed = 0;
    for (const row of pending) {
      const { count } = await this.prisma.notification.updateMany({
        where: { id: row.id, emailAttemptedAt: null },
        data: { emailAttemptedAt: new Date() },
      });
      if (count !== 1) continue;
      const url = row.link ? `${this.env.PUBLIC_APP_URL}${row.link}` : this.env.PUBLIC_APP_URL;
      try {
        await this.transport.sendMail({
          from: this.env.SMTP_FROM,
          to: row.user.email,
          subject: `${row.title} — Nikola Tesla Académie`,
          text: [
            `Bonjour ${row.user.firstName},`,
            '',
            row.body,
            '',
            `Pour en savoir plus : ${url}`,
            '',
            'Communauté Nikola Tesla',
          ].join('\n'),
        });
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { emailedAt: new Date() },
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Échec d’envoi d’une notification (${row.kind}, ${smtpErrorCode(error)})`,
        );
      }
    }
    return { sent, failed };
  }
}
