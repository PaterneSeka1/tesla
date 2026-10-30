import { z } from 'zod';
import { attemptSessionSchema, saveAnswersInputSchema } from './evaluations.js';
import { printableModuleSchema } from './modules.js';

export const offlineModulePackageSchema = z.object({
  versionId: z.uuid(),
  digest: z.string().length(64),
  content: printableModuleSchema,
});
export type OfflineModulePackage = z.infer<typeof offlineModulePackageSchema>;
export const offlineEvaluationPackageSchema = z.object({
  ownerId: z.uuid(),
  scoutProfileId: z.uuid(),
  versionId: z.uuid(),
  authorization: z.uuid(),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  policy: z.literal('RECEIVE_BEFORE_EXPIRY_RECHECK_RIGHTS'),
  session: attemptSessionSchema,
});
export type OfflineEvaluationPackage = z.infer<typeof offlineEvaluationPackageSchema>;
export const offlineSyncInputSchema = saveAnswersInputSchema
  .extend({
    operationId: z.uuid(),
    authorization: z.uuid(),
    versionId: z.uuid(),
    deviceSubmittedAt: z.iso.datetime(),
  })
  .strict();
export type OfflineSyncInput = z.input<typeof offlineSyncInputSchema>;
export const offlineStatusSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  syncStatus: z.enum(['LOCAL', 'SYNCHRONISE', 'REJETE']),
  code: z.string().nullable(),
  message: z.string(),
  receivedAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
});
export type OfflineStatus = z.infer<typeof offlineStatusSchema>;

// ─── Offline-first global (D109–D116) ────────────────────────────────

/**
 * En-tête porté par une écriture rejouable : le serveur l'enregistre (compte, méthode, chemin,
 * empreinte du corps) et renvoie la même réponse à un second envoi identique, sans nouvel effet.
 */
export const OPERATION_ID_HEADER = 'x-tesla-operation-id';

/** États d'une opération locale (file de synchronisation de l'appareil). */
export const OFFLINE_OPERATION_STATES = [
  'LOCAL',
  'EN_ATTENTE',
  'EN_COURS',
  'SYNCHRONISE',
  'CONFLIT',
  'REJETE',
] as const;
export type OfflineOperationState = (typeof OFFLINE_OPERATION_STATES)[number];

/**
 * Durée maximale d'usage local sans nouvelle vérification de la session par le serveur (jours).
 * Au-delà, les données restent chiffrées sur l'appareil mais ne sont plus affichées tant que
 * l'utilisateur ne s'est pas reconnecté. Valeur provisoire, à valider humainement (D112).
 */
export const OFFLINE_ACCESS_MAX_DAYS = 14;

/** Codes d'erreur de l'idempotence serveur. */
export const OPERATION_ERROR_CODES = {
  inProgress: 'OPERATION_IN_PROGRESS',
  reused: 'OPERATION_ID_REUSED',
  unconfirmed: 'OPERATION_UNCONFIRMED',
} as const;
