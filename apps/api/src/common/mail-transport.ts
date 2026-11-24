import { createTransport, type Transporter } from 'nodemailer';
import { type Env } from '../config/env.js';

/**
 * Transport SMTP facultatif (D166), partagé par les liens de compte et les notifications (D192).
 * Sans configuration complète (hôte, expéditeur, adresse publique), aucun e-mail n'est envoyé.
 */
export function createMailTransport(env: Env): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM || !env.PUBLIC_APP_URL) return null;
  return createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // Sans TLS implicite : STARTTLS obligatoire, jamais d'envoi en clair.
    requireTLS: !env.SMTP_SECURE,
    ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Code d'erreur seulement : le message du serveur SMTP peut citer l'adresse du destinataire. */
export function smtpErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'erreur';
}
