import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Interface d'écoute : 127.0.0.1 en production (seul Nginx joint l'API). */
    API_HOST: z.string().min(1).default('0.0.0.0'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'URL PostgreSQL attendue' }),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url({ error: 'Origine CORS invalide' }))),
    SWAGGER_ENABLED: booleanString.optional(),
    /** Durée de vie absolue d'une session (heures). */
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
    /** Validité d'un lien d'activation ou de réinitialisation du mot de passe (heures, D118). */
    ACCOUNT_LINK_TTL_HOURS: z.coerce.number().int().min(1).max(336).default(72),
    /** Derrière un proxy inverse (Nginx) : utiliser X-Forwarded-For pour l'adresse IP du client. */
    TRUST_PROXY: booleanString.default(false),
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

/** Valide les variables d'environnement et interrompt le démarrage si elles sont invalides. */
export function validateEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Configuration d'environnement invalide :\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
