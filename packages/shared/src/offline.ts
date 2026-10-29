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
