import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema } from './api.js';
import { ROLES } from './roles.js';

/**
 * Cycle de vie des comptes (D118–D121). Un compte est créé sans mot de passe par une personne
 * habilitée ; son titulaire choisit son mot de passe grâce à un lien d'activation à usage unique
 * (ou au code de secours qui l'accompagne, D162), transmis par une personne habilitée ou par e-mail
 * si SMTP est configuré (D166). La réinitialisation suit le même mécanisme, avec des jetons, des
 * routes et des journaux distincts. Le routier sans compte reste la règle (RM-001) : le compte se
 * rattache à sa fiche. Personne d'autre que le titulaire ne choisit ni ne connaît le mot de passe.
 */

/** Longueur minimale d'un mot de passe (recommandation NIST SP 800-63B : longueur, sans règles de composition). */
export const PASSWORD_MIN_LENGTH = 12;

/** Longueur maximale acceptée (phrases de passe ; jamais de troncature silencieuse). */
export const PASSWORD_MAX_LENGTH = 256;

/**
 * Mots de passe trop courants parmi ceux qui atteignent la longueur minimale (liste locale, sans
 * service externe). Comparaison sans casse ni espaces.
 */
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789123',
  '1234567890ab',
  '123456789abc',
  'abcdefghijkl',
  'abc123456789',
  'azertyuiop12',
  'azertyuiop123',
  'azertyuiopqs',
  'azertyuiopqsd',
  'qwertyuiop12',
  'qwertyuiop123',
  'qwertyuiopas',
  'password1234',
  'password12345',
  'passwordpassword',
  'motdepasse12',
  'motdepasse123',
  'motdepasse1234',
  'motdepassemotdepasse',
  'iloveyou1234',
  'jetaime123456',
  'bonjour12345',
  'bonjour123456',
  'soleil123456',
  'abidjan12345',
  'abidjan123456',
  'cotedivoire225',
  'nikolatesla1',
  'nikolatesla123',
  'nikolateslaacademie',
  'scoutisme1234',
  'routier12345',
  'routier123456',
  'azerty123456',
  'qwerty123456',
  'welcome12345',
  'administrator',
  'administrateur',
]);

/** Refus des mots de passe triviaux : liste courante, un seul caractère répété. */
export function isWeakPassword(value: string): boolean {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  return COMMON_PASSWORDS.has(normalized) || /^(.)\1*$/u.test(normalized);
}

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
  })
  .refine((value) => !isWeakPassword(value), {
    error: 'Ce mot de passe est trop courant. Choisissez une phrase plus personnelle.',
  });

const accountEmailSchema = z
  .email({ error: 'Adresse e-mail invalide.' })
  .max(254)
  .transform((value) => value.trim().toLowerCase());

const accountNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ce champ est requis.' })
  .max(100, { error: '100 caractères au maximum.' });

/** Jeton d'activation ou de réinitialisation (256 bits en base64url). */
export const accountTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, { error: 'Lien invalide ou incomplet.' });

/**
 * Code de secours (D162) : 10 caractères de l'alphabet de Crockford (sans I, L, O, U), affichés
 * « ABCDE-FGHJK ». Saisi avec l'e-mail ; lettres ambiguës, espaces et tirets tolérés à la saisie.
 */
export const ACTIVATION_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ACTIVATION_CODE_LENGTH = 10;

export function normalizeActivationCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const activationCodeSchema = z
  .string()
  .max(40)
  .transform(normalizeActivationCode)
  .pipe(
    z.string().regex(new RegExp(`^[${ACTIVATION_CODE_ALPHABET}]{${ACTIVATION_CODE_LENGTH}}$`), {
      error: 'Code invalide : 10 caractères, par exemple ABCDE-12345.',
    }),
  );

export const ACCOUNT_TOKEN_PURPOSES = ['ACTIVATION', 'REINITIALISATION'] as const;
export type AccountTokenPurpose = (typeof ACCOUNT_TOKEN_PURPOSES)[number];

export const ACCOUNT_STATUSES = ['A_ACTIVER', 'ACTIF', 'DESACTIVE'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  A_ACTIVER: 'À activer',
  ACTIF: 'Actif',
  DESACTIVE: 'Désactivé',
};

/**
 * Création d'un compte. `scoutProfileId` (compte routier) : rattachement à la fiche existante dans
 * la même transaction ; jamais de second profil.
 */
export const createAccountInputSchema = z
  .object({
    email: accountEmailSchema,
    firstName: accountNameSchema,
    lastName: accountNameSchema,
    role: z.enum(ROLES),
    scoutProfileId: z.uuid().optional(),
  })
  .refine((input) => !input.scoutProfileId || input.role === 'ROUTIER', {
    message: 'Seul un compte routier peut être rattaché à une fiche.',
    path: ['scoutProfileId'],
  });

export type CreateAccountInput = z.input<typeof createAccountInputSchema>;

export const updateAccountInputSchema = z
  .object({
    email: accountEmailSchema.optional(),
    firstName: accountNameSchema.optional(),
    lastName: accountNameSchema.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateAccountInput = z.input<typeof updateAccountInputSchema>;

/** Désactivation : motif obligatoire, conservé au journal. */
export const deactivateAccountInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Indiquez le motif.' })
    .max(500, { error: '500 caractères au maximum.' }),
});

export type DeactivateAccountInput = z.input<typeof deactivateAccountInputSchema>;

export const accountListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  role: z.enum(ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
});

export type AccountListQuery = z.input<typeof accountListQuerySchema>;

export const accountSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(ROLES),
  status: z.enum(ACCOUNT_STATUSES),
  scoutProfileId: z.uuid().nullable(),
  lastLoginAt: z.iso.datetime().nullable(),
  activeSessions: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export type Account = z.infer<typeof accountSchema>;

/**
 * Lien à usage unique, renvoyé une seule fois à la personne qui l'émet (jamais relisible).
 * Le web construit l'adresse `/activation#<token>` : le fragment n'est ni envoyé au serveur web ni journalisé.
 */
export const accountLinkSchema = z.object({
  token: z.string(),
  /** Code de secours équivalent au lien (D162), à transmettre séparément si possible. */
  code: z.string(),
  /** Vrai seulement si l'e-mail est réellement parti (SMTP configuré et envoi accepté, D166). */
  sentByEmail: z.boolean(),
  purpose: z.enum(ACCOUNT_TOKEN_PURPOSES),
  expiresAt: z.iso.datetime(),
});

export type AccountLink = z.infer<typeof accountLinkSchema>;

export const accountWithLinkSchema = z.object({
  account: accountSchema,
  link: accountLinkSchema,
});

export type AccountWithLink = z.infer<typeof accountWithLinkSchema>;

/** Vérification d'un lien avant saisie du mot de passe (public). */
export const accountTokenInputSchema = z.object({ token: accountTokenSchema });

export const accountTokenInfoSchema = z.object({
  purpose: z.enum(ACCOUNT_TOKEN_PURPOSES),
  firstName: z.string(),
  expiresAt: z.iso.datetime(),
});

export type AccountTokenInfo = z.infer<typeof accountTokenInfoSchema>;

/**
 * Preuve d'invitation ou de récupération (D162) : le jeton du lien, ou l'e-mail avec le code de
 * secours. Les deux mènent au même contrôle serveur ; un matricule ou une date de naissance ne
 * suffisent jamais.
 */
export const accountCredentialSchema = z.union([
  z.object({ token: accountTokenSchema }),
  z.object({
    email: z
      .email({ error: 'Adresse e-mail invalide.' })
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    code: activationCodeSchema,
  }),
]);

export type AccountCredential = z.input<typeof accountCredentialSchema>;

/** Vérification préalable (ne consomme rien) : renvoie le prénom et l'échéance seulement. */
export const verifyAccountCredentialInputSchema = accountCredentialSchema;

/** Définition du mot de passe : la preuve est revérifiée et consommée atomiquement. */
export const completeAccountCredentialInputSchema = z.intersection(
  accountCredentialSchema,
  z.object({ password: newPasswordSchema }),
);

export type CompleteAccountCredentialInput = z.input<typeof completeAccountCredentialInputSchema>;

/** « Mot de passe oublié » en libre-service (public, réponse neutre). */
export const passwordResetRequestInputSchema = z.object({
  email: z
    .email({ error: 'Adresse e-mail invalide.' })
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
});

export type PasswordResetRequestInput = z.input<typeof passwordResetRequestInputSchema>;

/**
 * Réponse identique que le compte existe ou non. `channel` ne dépend que de la configuration :
 * `EMAIL` si l'envoi est configuré, `RESPONSABLE` sinon (récupération administrée, rien n'est envoyé).
 */
export const passwordResetRequestResultSchema = z.object({
  channel: z.enum(['EMAIL', 'RESPONSABLE']),
});

export type PasswordResetRequestResult = z.infer<typeof passwordResetRequestResultSchema>;

/** Définition du mot de passe par le titulaire du lien (public). */
export const completeAccountTokenInputSchema = z.object({
  token: accountTokenSchema,
  password: newPasswordSchema,
});

export type CompleteAccountTokenInput = z.input<typeof completeAccountTokenInputSchema>;

/** Changement de mot de passe par l'utilisateur connecté : les autres sessions sont révoquées. */
export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'Le mot de passe actuel est requis.' }).max(256),
    newPassword: newPasswordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel.',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.input<typeof changePasswordInputSchema>;

/** Profil personnel : nom affiché. L'adresse e-mail se modifie par une personne habilitée. */
export const updateProfileInputSchema = z.object({
  firstName: accountNameSchema,
  lastName: accountNameSchema,
});

export type UpdateProfileInput = z.input<typeof updateProfileInputSchema>;

export const sessionInfoSchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;

export const sessionListSchema = z.object({ items: z.array(sessionInfoSchema) });

export type SessionList = z.infer<typeof sessionListSchema>;

export const revokedSessionsSchema = z.object({ revoked: z.number().int().nonnegative() });

export type RevokedSessions = z.infer<typeof revokedSessionsSchema>;
