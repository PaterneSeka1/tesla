import {
  type OfflineEvaluationPackage,
  type OfflineStatus,
  type OfflineSyncInput,
  type SaveAnswersInput,
  offlineEvaluationPackageSchema,
  offlineStatusSchema,
} from '@tesla/shared';
import { ApiError, apiSend } from '@/lib/api/client';
import { withSyncLock } from './db';
import { assertOnlineOwner, ownerId, readRecord, recordIds, writeRecord } from './vault';

export type SyncState = 'LOCAL' | 'EN_ATTENTE' | 'EN_COURS' | 'SYNCHRONISE' | 'REJETE' | 'CONFLIT';

/** Libellés affichés au routier (les codes restent internes). */
export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  LOCAL: 'En cours sur cet appareil',
  EN_ATTENTE: 'À synchroniser',
  EN_COURS: 'Synchronisation en cours',
  SYNCHRONISE: 'Synchronisée',
  REJETE: 'Rejetée',
  CONFLIT: 'Conflit à résoudre',
};
export interface LocalAttempt {
  package: OfflineEvaluationPackage;
  answers: SaveAnswersInput['answers'];
  status: SyncState;
  operationId: string;
  createdAt: string;
  deviceSubmittedAt: string | null;
  retries: number;
  nextRetryAt: number;
  lastError: string | null;
  server: OfflineStatus | null;
}
export async function prepareEvaluation(id: string) {
  await assertOnlineOwner();
  const pkg = await apiSend(
    'POST',
    `/offline/evaluations/${id}/prepare`,
    offlineEvaluationPackageSchema,
  );
  if (pkg.ownerId !== ownerId()) throw new Error('Paquet lié à un autre compte.');
  const existing = await readRecord<LocalAttempt>(`attempt:${pkg.session.id}`);
  if (!existing)
    await writeRecord(
      `attempt:${pkg.session.id}`,
      {
        package: pkg,
        answers: pkg.session.questions.map((q) => ({ questionId: q.id, optionIds: [], text: '' })),
        status: 'LOCAL',
        operationId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        deviceSubmittedAt: null,
        retries: 0,
        nextRetryAt: 0,
        lastError: null,
        server: null,
      } satisfies LocalAttempt,
      0,
    );
  return pkg.session.id;
}
export async function listAttempts() {
  const ids = await recordIds('attempt:');
  return (await Promise.all(ids.map((id) => readRecord<LocalAttempt>(id)))).flatMap((row) =>
    row ? [row.value] : [],
  );
}
export async function saveLocalAnswers(
  id: string,
  answers: LocalAttempt['answers'],
  revision: number,
) {
  const row = await readRecord<LocalAttempt>(`attempt:${id}`);
  if (!row || row.revision !== revision || row.value.status !== 'LOCAL')
    throw new Error('Cette copie n’est plus modifiable. Rechargez-la.');
  await writeRecord(`attempt:${id}`, { ...row.value, answers }, revision);
}
/** Réservation échue : le serveur refuserait la copie (réception exigée avant l'échéance, D78). */
export function reservationExpired(item: LocalAttempt, now = Date.now()) {
  return new Date(item.package.expiresAt).getTime() <= now;
}
export async function submitLocal(id: string) {
  const row = await readRecord<LocalAttempt>(`attempt:${id}`);
  if (!row || row.value.status !== 'LOCAL') throw new Error('Tentative déjà remise.');
  if (reservationExpired(row.value))
    throw new Error(
      'La réservation de cette évaluation a expiré : la copie ne peut plus être remise. Préparez une nouvelle tentative en ligne si elle reste ouverte.',
    );
  await writeRecord(
    `attempt:${id}`,
    { ...row.value, status: 'EN_ATTENTE', deviceSubmittedAt: new Date().toISOString() },
    row.revision,
  );
}
export function retryDelay(retries: number) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.min(retries, 9));
}
const MAX_AUTOMATIC_RETRIES = 6;
let syncing = false;
/** Reprises bornées ; EN_COURS récupérable après fermeture/crash. Le serveur déduplique. */
export function syncAttempts(manual = false): Promise<void> {
  return withSyncLock('attempts', undefined, () => sendDueAttempts(manual));
}
async function sendDueAttempts(manual: boolean) {
  if (syncing || !ownerId()) return;
  syncing = true;
  try {
    const ids = await recordIds('attempt:');
    const candidates = await listAttempts();
    if (
      !candidates.some(
        (a) =>
          ['EN_ATTENTE', 'EN_COURS'].includes(a.status) &&
          (manual || (a.retries < MAX_AUTOMATIC_RETRIES && a.nextRetryAt <= Date.now())),
      )
    )
      return;
    try {
      await assertOnlineOwner();
    } catch (error) {
      if (!ownerId()) throw error;
      for (const id of ids) {
        const row = await readRecord<LocalAttempt>(id);
        if (!row || !['EN_ATTENTE', 'EN_COURS'].includes(row.value.status)) continue;
        const auth = error instanceof ApiError && error.status === 401;
        // Réseau absent : réessai au retour de la connexion, sans consommer d'essai (AUD-024).
        const offline = !(error instanceof ApiError) || error.status === 0;
        await writeRecord(
          id,
          {
            ...row.value,
            status: 'EN_ATTENTE',
            retries: auth
              ? MAX_AUTOMATIC_RETRIES
              : offline
                ? row.value.retries
                : row.value.retries + 1,
            nextRetryAt: Date.now() + retryDelay(row.value.retries),
            lastError: auth
              ? 'Session expirée. Reconnectez-vous avec le même compte puis synchronisez manuellement.'
              : error instanceof Error
                ? error.message
                : 'Synchronisation impossible pour le moment.',
          },
          row.revision,
        );
      }
      return;
    }
    for (const id of ids) {
      let row = await readRecord<LocalAttempt>(id);
      if (!row || !['EN_ATTENTE', 'EN_COURS'].includes(row.value.status)) continue;
      if (
        !manual &&
        (row.value.retries >= MAX_AUTOMATIC_RETRIES || row.value.nextRetryAt > Date.now())
      )
        continue;
      const item = row.value;
      if (item.package.ownerId !== ownerId()) throw new Error('Identité locale incompatible.');
      await writeRecord(id, { ...item, status: 'EN_COURS' }, row.revision);
      row = await readRecord<LocalAttempt>(id);
      if (!row) continue;
      try {
        const input: OfflineSyncInput = {
          operationId: item.operationId,
          authorization: item.package.authorization,
          versionId: item.package.versionId,
          deviceSubmittedAt: item.deviceSubmittedAt!,
          answers: item.answers,
        };
        const server = await apiSend(
          'POST',
          `/offline/attempts/${item.package.session.id}/sync`,
          offlineStatusSchema,
          input,
        );
        if (!['SYNCHRONISE', 'REJETE'].includes(server.syncStatus))
          throw new Error('Réception non confirmée. Réessayez la synchronisation.');
        await writeRecord(
          id,
          {
            ...item,
            status: server.syncStatus,
            server,
            lastError: server.syncStatus === 'REJETE' ? server.message : null,
          },
          row.revision,
        );
      } catch (error) {
        const api = error instanceof ApiError ? error : null;
        const offline = !api || api.status === 0;
        const transient = offline || api.status >= 500 || api.status === 429 || api.status === 401;
        const status: SyncState = transient
          ? 'EN_ATTENTE'
          : api.status === 409
            ? 'CONFLIT'
            : 'REJETE';
        await writeRecord(
          id,
          {
            ...item,
            status,
            retries: offline ? item.retries : item.retries + 1,
            nextRetryAt: Date.now() + retryDelay(item.retries),
            lastError:
              api?.status === 401
                ? 'Session expirée. Reconnectez-vous avec le même compte.'
                : error instanceof Error
                  ? error.message
                  : 'Synchronisation interrompue.',
          },
          row.revision,
        );
        if (api?.status === 401 || api?.status === 0) break;
      }
    }
  } finally {
    syncing = false;
  }
}
/** Copie de cet appareil pour une évaluation (la plus récente non confirmée, sinon la dernière). */
export async function findLocalAttempt(evaluationId: string): Promise<LocalAttempt | null> {
  if (!ownerId()) return null;
  const copies = (await listAttempts())
    .filter((a) => a.package.session.evaluation.id === evaluationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return copies.find((a) => a.status !== 'SYNCHRONISE') ?? null;
}
