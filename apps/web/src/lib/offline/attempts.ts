import {
  type OfflineEvaluationPackage,
  type OfflineStatus,
  type OfflineSyncInput,
  type SaveAnswersInput,
  offlineEvaluationPackageSchema,
  offlineStatusSchema,
} from '@tesla/shared';
import { ApiError, apiSend } from '@/lib/api/client';
import { assertOnlineOwner, ownerId, readRecord, recordIds, writeRecord } from './vault';

export type SyncState = 'LOCAL' | 'EN_ATTENTE' | 'EN_COURS' | 'SYNCHRONISE' | 'REJETE' | 'CONFLIT';
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
export async function submitLocal(id: string) {
  const row = await readRecord<LocalAttempt>(`attempt:${id}`);
  if (!row || row.value.status !== 'LOCAL') throw new Error('Tentative déjà remise.');
  await writeRecord(
    `attempt:${id}`,
    { ...row.value, status: 'EN_ATTENTE', deviceSubmittedAt: new Date().toISOString() },
    row.revision,
  );
}
export function retryDelay(retries: number) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.min(retries, 9));
}
let syncing = false;
/** Reprises bornées ; EN_COURS récupérable après fermeture/crash. Le serveur déduplique. */
export async function syncAttempts(manual = false) {
  if (syncing || !ownerId()) return;
  syncing = true;
  try {
    const ids = await recordIds('attempt:');
    const candidates = await listAttempts();
    if (
      !candidates.some(
        (a) =>
          ['EN_ATTENTE', 'EN_COURS'].includes(a.status) &&
          (manual || (a.retries < 6 && a.nextRetryAt <= Date.now())),
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
        await writeRecord(
          id,
          {
            ...row.value,
            status: 'EN_ATTENTE',
            retries: auth ? 6 : row.value.retries + 1,
            nextRetryAt: Date.now() + retryDelay(row.value.retries),
            lastError: auth
              ? 'Session expirée. Reconnectez-vous avec le même compte puis synchronisez manuellement.'
              : error instanceof Error
                ? error.message
                : 'Serveur indisponible.',
          },
          row.revision,
        );
      }
      return;
    }
    for (const id of ids) {
      let row = await readRecord<LocalAttempt>(id);
      if (!row || !['EN_ATTENTE', 'EN_COURS'].includes(row.value.status)) continue;
      if (!manual && (row.value.retries >= 6 || row.value.nextRetryAt > Date.now())) continue;
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
          throw new Error('Le serveur n’a pas confirmé la réception.');
        await writeRecord(
          id,
          {
            ...item,
            status: server.syncStatus,
            server,
            lastError: server.syncStatus === 'REJETE' ? `${server.code} — ${server.message}` : null,
          },
          row.revision,
        );
      } catch (error) {
        const api = error instanceof ApiError ? error : null;
        const transient =
          !api || api.status === 0 || api.status >= 500 || api.status === 429 || api.status === 401;
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
            retries: item.retries + 1,
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
