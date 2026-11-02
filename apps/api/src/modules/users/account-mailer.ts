import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AccountTokenPurpose } from '@tesla/shared';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';

/** Pages du site qui reçoivent le jeton dans le fragment d'adresse (jamais envoyé au serveur web). */
export const ACCOUNT_LINK_PATHS: Record<AccountTokenPurpose, string> = {
  ACTIVATION: '/inscription',
  REINITIALISATION: '/reinitialiser-mot-de-passe',
};

/**
 * Envoi facultatif des liens de compte par e-mail (D166). Sans configuration SMTP, `enabled` est
 * faux : la récupération est administrée et l'interface ne prétend jamais qu'un e-mail est parti.
 * Le message contient le lien et le code ; ni l'un ni l'autre n'est journalisé.
 */
@Injectable()
export class AccountMailer {
  private readonly logger = new Logger(AccountMailer.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport =
      env.SMTP_HOST && env.SMTP_FROM && env.PUBLIC_APP_URL
        ? createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            // Sans TLS implicite : STARTTLS obligatoire, jamais d'envoi en clair.
            requireTLS: !env.SMTP_SECURE,
            ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }),
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
          })
        : null;
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  /**
   * Envoie le lien et le code. Ne lève jamais : un échec est journalisé sans destinataire ni
   * secret, et l'appelant répond de la même façon (aucune énumération des comptes).
   */
  async sendAccountLink(input: {
    to: string;
    firstName: string;
    purpose: AccountTokenPurpose;
    token: string;
    code: string;
    expiresAt: Date;
  }): Promise<boolean> {
    if (!this.transport) return false;
    const url = `${this.env.PUBLIC_APP_URL}${ACCOUNT_LINK_PATHS[input.purpose]}#${encodeURIComponent(input.token)}`;
    const activation = input.purpose === 'ACTIVATION';
    const until = input.expiresAt.toLocaleString('fr-FR', {
      timeZone: 'Africa/Abidjan',
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const text = [
      `Bonjour ${input.firstName},`,
      '',
      activation
        ? 'Votre accès à Nikola Tesla Académie a été autorisé. Pour activer votre compte et choisir votre mot de passe, ouvrez ce lien :'
        : 'Une demande de nouveau mot de passe a été faite pour votre compte Nikola Tesla Académie. Pour choisir un nouveau mot de passe, ouvrez ce lien :',
      url,
      '',
      `Si le lien ne s’ouvre pas, saisissez ce code sur la page ${activation ? '« Activer mon compte »' : '« Mot de passe oublié »'}, avec votre adresse e-mail : ${input.code}`,
      '',
      `Ce lien et ce code ne fonctionnent qu’une fois, jusqu’au ${until}.`,
      activation
        ? 'Si vous n’attendiez pas ce message, ignorez-le.'
        : 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.',
      '',
      'Communauté Nikola Tesla',
    ].join('\n');
    try {
      await this.transport.sendMail({
        from: this.env.SMTP_FROM,
        to: input.to,
        subject: activation
          ? 'Activer votre compte Nikola Tesla Académie'
          : 'Nouveau mot de passe — Nikola Tesla Académie',
        text,
      });
      return true;
    } catch (error) {
      // Code d'erreur seulement : le message du serveur SMTP peut citer l'adresse du destinataire.
      const code = (error as { code?: unknown } | null)?.code;
      this.logger.error(
        `Échec d’envoi d’un e-mail de compte (${input.purpose}, ${typeof code === 'string' ? code : 'erreur'})`,
      );
      return false;
    }
  }
}
