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
    /** Validité d'une demande « mot de passe oublié » en libre-service (minutes, D166). */
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(1440).default(60),
    /**
     * Adresse publique du site (liens envoyés par e-mail), ex. https://tesla.example.org. Requise
     * avec SMTP ; jamais déduite de l'en-tête Host de la requête (empoisonnement de lien).
     */
    PUBLIC_APP_URL: z
      .url({ protocol: /^https?$/, error: 'URL http(s) du site attendue' })
      .transform((value) => value.replace(/\/+$/, ''))
      .optional(),
    /**
     * Envoi des liens d'activation et de récupération par e-mail (facultatif, D166). Tout ou rien :
     * absent, la récupération est administrée (lien remis par une personne habilitée) et aucun
     * message ne prétend qu'un e-mail a été envoyé.
     */
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    /** true : TLS dès la connexion (port 465) ; false : STARTTLS exigé (port 587). */
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    /** Expéditeur, ex. « Nikola Tesla Académie <no-reply@example.org> ». */
    SMTP_FROM: z.string().trim().min(3).optional(),
    /** Derrière un proxy inverse (Nginx) : utiliser X-Forwarded-For pour l'adresse IP du client. */
    TRUST_PROXY: booleanString.default(false),
    /**
     * Clé de chiffrement des fiches médicales (32 octets en base64, D136). Obligatoire en production ;
     * absente ailleurs, les fiches médicales sont indisponibles (503) plutôt que stockées en clair.
     */
    MEDICAL_DATA_KEY: z
      .string()
      .trim()
      .refine((value) => Buffer.from(value, 'base64').length === 32, {
        error: '32 octets encodés en base64 attendus (openssl rand -base64 32).',
      })
      .optional(),
    /**
     * Stockage objet compatible S3 (Cloudflare R2, D143). Tout ou rien : absent, les fichiers joints
     * sont indisponibles (503) ; partiel, le démarrage échoue. Clés propres à l'application, limitées
     * à son compartiment (jamais celles des sauvegardes).
     */
    R2_ACCOUNT_ID: z
      .string()
      .trim()
      .regex(/^[0-9a-f]{32}$/, {
        error: 'Identifiant de compte Cloudflare (32 caractères hexadécimaux) attendu.',
      })
      .optional(),
    R2_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    /** Facultatif : déduit de R2_ACCOUNT_ID ; à renseigner pour un autre fournisseur compatible S3. */
    R2_ENDPOINT: z
      .url({ protocol: /^https?$/, error: 'URL http(s) du point d’accès S3 attendue' })
      .optional(),
    R2_BUCKET_NAME: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
        error: 'Nom de compartiment invalide (a-z, 0-9, -).',
      })
      .optional(),
    R2_REGION: z.string().trim().min(1).default('auto'),
    /** Préfixe des clés d'objet (séparation logique : production, preproduction, development…). */
    R2_KEY_PREFIX: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,40}$/, {
        error: 'Préfixe attendu : a-z, 0-9, - (40 caractères au plus).',
      })
      .optional(),
    /** Plafond global d'un fichier (octets) ; les plafonds par type (5 Mo images, 20 Mo PDF) s'appliquent aussi. */
    R2_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(100 * 1024 * 1024)
      .default(20 * 1024 * 1024),
    /** Durée de validité des URL signées d'envoi et de lecture (secondes). */
    R2_SIGNED_URL_EXPIRATION: z.coerce.number().int().min(60).max(3600).default(300),
  })
  .superRefine((env, ctx) => {
    const keys = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'] as const;
    const present = keys.filter((key) => env[key] !== undefined);
    const anySet =
      present.length > 0 || env.R2_ACCOUNT_ID !== undefined || env.R2_ENDPOINT !== undefined;
    if (!anySet) return;
    for (const key of keys) {
      if (env[key] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} manquant : configuration R2 incomplète.`,
        });
      }
    }
    if (env.R2_ACCOUNT_ID === undefined && env.R2_ENDPOINT === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['R2_ACCOUNT_ID'],
        message: 'R2_ACCOUNT_ID ou R2_ENDPOINT requis : configuration R2 incomplète.',
      });
    }
    if (env.NODE_ENV === 'production' && env.R2_ENDPOINT?.startsWith('http:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['R2_ENDPOINT'],
        message: 'https:// obligatoire en production.',
      });
    }
  })
  .superRefine((env, ctx) => {
    const keys = ['SMTP_HOST', 'SMTP_FROM', 'PUBLIC_APP_URL'] as const;
    if (env.SMTP_HOST === undefined && env.SMTP_FROM === undefined) return;
    for (const key of keys) {
      if (env[key] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} manquant : configuration SMTP incomplète.`,
        });
      }
    }
    if ((env.SMTP_USER === undefined) !== (env.SMTP_PASSWORD === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER et SMTP_PASSWORD vont ensemble.',
      });
    }
    if (env.NODE_ENV === 'production' && env.PUBLIC_APP_URL?.startsWith('http:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_APP_URL'],
        message: 'https:// obligatoire en production.',
      });
    }
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.MEDICAL_DATA_KEY !== undefined, {
    error: 'MEDICAL_DATA_KEY est obligatoire en production.',
    path: ['MEDICAL_DATA_KEY'],
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    R2_ENDPOINT:
      env.R2_ENDPOINT ??
      (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined),
    R2_KEY_PREFIX: env.R2_KEY_PREFIX ?? env.NODE_ENV,
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
