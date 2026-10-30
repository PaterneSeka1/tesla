import {
  type OfflineOperationState,
  OPERATION_ERROR_CODES,
  OPERATION_ID_HEADER,
  type Permission,
} from '@tesla/shared';
import { z } from 'zod';
import { ApiError, apiFetch } from '@/lib/api/client';
import { patchStoredResponse } from './repository';
import {
  assertOnlineOwner,
  deleteRecord,
  localIdentity,
  ownerId,
  putRecord,
  readRecord,
  recordIds,
  writeRecord,
} from './vault';

// File de synchronisation globale (D110) : une opération = une écriture d'API rejouable, avec un
// identifiant unique envoyé au serveur (idempotence), des dépendances et un état explicite.
// Seuls les types déclarés dans `OPERATION_TYPES` peuvent être différés : les décisions
// officielles (étapes, acquis, mandats, publications, validations) exigent le serveur.

export type OperationType =
  | 'attendance.save'
  | 'activity.create'
  | 'activity.update'
  | 'activity.status'
  | 'observation.create'
  | 'scout.create'
  | 'scout.update'
  | 'team.assign';

export interface LocalOperation {
  id: string;
  ownerId: string;
  type: OperationType;
  label: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  entity: { kind: string; id: string };
  /** Identifiant provisoire attribué localement à l'entité créée (remplacé après synchronisation). */
  tempId: string | null;
  dependsOn: string[];
  createdAt: string;
  status: OfflineOperationState;
  retries: number;
  nextRetryAt: number;
  lastError: string | null;
  serverCode: string | null;
  response: unknown;
}

type Body = Record<string, unknown>;
interface OperationTypeDefinition {
  permission: Permission;
  /** Fusion d'une nouvelle saisie dans une opération pas encore envoyée (même entité). */
  merge?: (previous: Body, next: Body) => Body;
  /** Mise à jour de la version de référence après confirmation d'une opération précédente. */
  rebase?: (body: Body, previousResponse: Body) => Body;
  /** Affichage provisoire dans la copie locale de l'écran concerné. */
  overlay?: (op: LocalOperation) => { path: string; update: (body: unknown) => unknown }[];
}

const isRecord = (value: unknown): value is Body =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const rebaseRevision = (body: Body, response: Body) =>
  typeof response.revision === 'number' ? { ...body, revision: response.revision } : body;
/** Champs simples d'une saisie reportés sur la copie locale (jamais les identifiants ni versions). */
function mergeScalars(target: unknown, input: unknown) {
  if (!isRecord(target) || !isRecord(input)) return target;
  const next = { ...target };
  for (const [field, value] of Object.entries(input)) {
    if (['id', 'revision', 'expectedUpdatedAt', 'updatedAt'].includes(field)) continue;
    if (field in target && (value === null || ['string', 'number'].includes(typeof value)))
      next[field] = value;
  }
  return next;
}

export const OPERATION_TYPES: Record<OperationType, OperationTypeDefinition> = {
  'attendance.save': {
    permission: 'attendance.record',
    merge: (previous, next) => {
      const entries = new Map<string, Body>();
      for (const entry of [...(previous.entries as Body[]), ...(next.entries as Body[])]) {
        const id = entry.scoutProfileId as string;
        // Le statut de référence reste celui de la première saisie.
        entries.set(id, {
          ...entry,
          expectedStatus: entries.get(id)?.expectedStatus ?? entry.expectedStatus,
        });
      }
      return { entries: [...entries.values()] };
    },
    overlay: (op) => [
      {
        path: `/activities/${op.entity.id}/attendance`,
        update: (sheet) => {
          if (!isRecord(sheet) || !Array.isArray(sheet.entries)) return sheet;
          const saved = new Map(
            ((op.body as Body).entries as Body[]).map((e) => [e.scoutProfileId as string, e]),
          );
          return {
            ...sheet,
            entries: sheet.entries.map((row: Body) => {
              const entry = saved.get((row.scout as Body).id as string);
              return entry ? { ...row, status: entry.status, note: entry.note ?? row.note } : row;
            }),
          };
        },
      },
    ],
  },
  'activity.create': { permission: 'activity.manage' },
  'activity.update': {
    permission: 'activity.manage',
    merge: (previous, next) => ({ ...previous, ...next, revision: previous.revision }),
    rebase: rebaseRevision,
    overlay: (op) => [
      { path: `/activities/${op.entity.id}`, update: (detail) => mergeScalars(detail, op.body) },
    ],
  },
  'activity.status': { permission: 'activity.manage', rebase: rebaseRevision },
  'observation.create': { permission: 'observation.create' },
  'scout.create': { permission: 'scout.create' },
  'scout.update': {
    permission: 'scout.update',
    merge: (previous, next) => ({
      ...previous,
      ...next,
      expectedUpdatedAt: previous.expectedUpdatedAt,
    }),
    rebase: (body, response) =>
      typeof response.updatedAt === 'string'
        ? { ...body, expectedUpdatedAt: response.updatedAt }
        : body,
    overlay: (op) => [
      { path: `/scouts/${op.entity.id}`, update: (detail) => mergeScalars(detail, op.body) },
    ],
  },
  'team.assign': {
    permission: 'team.assign',
    rebase: (body, response) => {
      const open = Array.isArray(response.items)
        ? (response.items as Body[]).find((item) => item.endedAt === null)
        : undefined;
      return open
        ? { ...body, expectedTeamId: (open.team as Body | undefined)?.id ?? open.teamId }
        : body;
    },
  },
};

/** Écriture différée : l'opération est enregistrée sur l'appareil, pas encore sur le serveur. */
export class OfflineQueuedError extends Error {
  constructor(
    readonly operationId: string,
    readonly tempId: string | null,
  ) {
    super(
      'Hors connexion : modification enregistrée sur cet appareil, en attente de synchronisation.',
    );
    this.name = 'OfflineQueuedError';
  }
}

export interface OfflineWrite {
  type: OperationType;
  /** Libellé affiché dans la liste des modifications en attente. */
  label: string;
  entity: { kind: string; id: string };
  /** Création : un identifiant provisoire est attribué localement. */
  creates?: boolean;
}

const FINAL: OfflineOperationState[] = ['SYNCHRONISE'];
const ACTIVE: OfflineOperationState[] = ['EN_ATTENTE', 'EN_COURS'];
const MAX_AUTOMATIC_RETRIES = 6;
const opKey = (id: string) => `op:${id}`;

export function retryDelay(retries: number) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.min(retries, 9));
}

export async function listOperations(): Promise<{ value: LocalOperation; revision: number }[]> {
  const ids = await recordIds('op:');
  const rows = await Promise.all(ids.map((id) => readRecord<LocalOperation>(id)));
  return rows
    .flatMap((row) => (row ? [row] : []))
    .sort((a, b) => a.value.createdAt.localeCompare(b.value.createdAt));
}

/**
 * Enregistre une écriture différée après contrôle local des permissions connues.
 * `sent` : l'envoi a déjà été tenté (coupure pendant la requête) ; le serveur a peut-être reçu ce
 * corps sous cet identifiant, qui ne doit donc plus changer : aucune fusion, dans un sens ou l'autre.
 */
export async function enqueueOperation(
  operationId: string,
  method: LocalOperation['method'],
  path: string,
  body: unknown,
  write: OfflineWrite,
  { sent = false } = {},
): Promise<LocalOperation> {
  const owner = ownerId();
  const identity = await localIdentity();
  if (!owner || !identity)
    throw new ApiError(
      0,
      'OFFLINE_LOCKED',
      'Hors connexion. Déverrouillez cet appareil pour enregistrer vos modifications localement.',
    );
  const definition = OPERATION_TYPES[write.type];
  if (!identity.permissions.includes(definition.permission))
    throw new ApiError(403, 'FORBIDDEN', 'Action non autorisée avec vos permissions actuelles.');

  const existing = await listOperations();
  const unsettled = existing.filter((row) => !FINAL.includes(row.value.status));
  // Fusion dans une saisie identique pas encore partie (aucun envoi tenté).
  const mergeable =
    definition.merge && !sent
      ? unsettled.find(
          (row) =>
            row.value.type === write.type &&
            row.value.entity.id === write.entity.id &&
            row.value.status === 'EN_ATTENTE' &&
            row.value.retries === 0,
        )
      : undefined;
  if (mergeable && definition.merge && isRecord(mergeable.value.body) && isRecord(body)) {
    const merged = { ...mergeable.value, body: definition.merge(mergeable.value.body, body) };
    await writeRecord(opKey(merged.id), merged, mergeable.revision);
    await applyOverlay(merged);
    return merged;
  }
  const serialized = `${path} ${JSON.stringify(body)}`;
  const op: LocalOperation = {
    id: operationId,
    ownerId: owner,
    type: write.type,
    label: write.label,
    method,
    path,
    body,
    entity: write.entity,
    tempId: write.creates ? write.entity.id : null,
    // Ordre garanti : opérations précédentes sur la même entité, et créations dont l'identifiant
    // provisoire est utilisé ici.
    dependsOn: unsettled
      .filter(
        (row) =>
          row.value.entity.id === write.entity.id ||
          (row.value.tempId !== null && serialized.includes(row.value.tempId)),
      )
      .map((row) => row.value.id),
    createdAt: new Date().toISOString(),
    status: 'EN_ATTENTE',
    // Un envoi déjà tenté compte comme essai : l'opération n'est plus fusionnable.
    retries: sent ? 1 : 0,
    nextRetryAt: 0,
    lastError: null,
    serverCode: null,
    response: null,
  };
  await writeRecord(opKey(op.id), op, 0);
  await applyOverlay(op);
  return op;
}

async function applyOverlay(op: LocalOperation) {
  for (const { path, update } of OPERATION_TYPES[op.type].overlay?.(op) ?? [])
    await patchStoredResponse(path, op.id, update).catch(() => {});
}

/** Correspondance identifiant provisoire → identifiant serveur. */
async function idMap(): Promise<Record<string, string>> {
  return (await readRecord<Record<string, string>>('meta:idmap').catch(() => null))?.value ?? {};
}
export function substituteIds<T>(value: T, map: Record<string, string>): T {
  let text = JSON.stringify(value);
  for (const [temp, real] of Object.entries(map)) text = text.replaceAll(temp, real);
  return JSON.parse(text) as T;
}

/** Classement d'un échec d'envoi (D110). */
export function classifyFailure(error: unknown): {
  status: OfflineOperationState;
  transient: boolean;
  stop: boolean;
} {
  const api = error instanceof ApiError ? error : null;
  if (!api || api.status === 0) return { status: 'EN_ATTENTE', transient: true, stop: true };
  if (api.status === 401) return { status: 'EN_ATTENTE', transient: true, stop: true };
  if (api.status >= 500 || api.status === 429 || api.code === OPERATION_ERROR_CODES.inProgress)
    return { status: 'EN_ATTENTE', transient: true, stop: false };
  if (api.status === 409) return { status: 'CONFLIT', transient: false, stop: false };
  return { status: 'REJETE', transient: false, stop: false };
}

let syncing = false;
/**
 * Envoie les opérations dues, dans l'ordre, après vérification du compte connecté. Un état
 * `EN_COURS` laissé par une fermeture brutale est repris : le serveur déduplique.
 * Retourne le nombre d'opérations dont l'état a changé.
 */
export async function syncOperations(manual = false): Promise<number> {
  if (syncing || !ownerId()) return 0;
  syncing = true;
  let changed = 0;
  try {
    const due = (op: LocalOperation) =>
      ACTIVE.includes(op.status) &&
      (manual || (op.retries < MAX_AUTOMATIC_RETRIES && op.nextRetryAt <= Date.now()));
    if (!(await listOperations()).some((row) => due(row.value))) return 0;
    try {
      await assertOnlineOwner();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        for (const row of await listOperations())
          if (ACTIVE.includes(row.value.status))
            await writeRecord(
              opKey(row.value.id),
              {
                ...row.value,
                status: 'EN_ATTENTE',
                lastError:
                  'Session expirée. Reconnectez-vous avec le même compte pour synchroniser.',
              },
              row.revision,
            );
      }
      return 0;
    }
    const map = await idMap();
    for (const row of await listOperations()) {
      const op = row.value;
      if (!due(op)) continue;
      const dependencies = (await listOperations()).filter((r) =>
        op.dependsOn.includes(r.value.id),
      );
      const blocked = dependencies.find((r) => ['CONFLIT', 'REJETE'].includes(r.value.status));
      if (blocked) {
        await writeRecord(
          opKey(op.id),
          {
            ...op,
            status: 'CONFLIT',
            lastError: `Dépend d’une modification non synchronisée : « ${blocked.value.label} ».`,
          },
          row.revision,
        );
        changed++;
        continue;
      }
      if (dependencies.some((r) => r.value.status !== 'SYNCHRONISE')) continue;
      let body = substituteIds(op.body, map);
      const rebase = OPERATION_TYPES[op.type].rebase;
      const previous = dependencies
        .filter((r) => r.value.entity.id === op.entity.id && isRecord(r.value.response))
        .at(-1);
      if (rebase && previous && isRecord(body))
        body = rebase(body, previous.value.response as Body);
      await writeRecord(opKey(op.id), { ...op, status: 'EN_COURS' }, row.revision);
      const sending = await readRecord<LocalOperation>(opKey(op.id));
      if (!sending) continue;
      try {
        const response = await apiFetch(substituteIds(op.path, map), z.unknown(), {
          method: op.method,
          headers: { 'Content-Type': 'application/json', [OPERATION_ID_HEADER]: op.id },
          body: JSON.stringify(body),
        });
        if (op.tempId && isRecord(response) && typeof response.id === 'string') {
          map[op.tempId] = response.id;
          await putRecord('meta:idmap', map);
        }
        await writeRecord(
          opKey(op.id),
          { ...op, body, status: 'SYNCHRONISE', response, lastError: null, serverCode: null },
          sending.revision,
        );
        changed++;
      } catch (error) {
        const outcome = classifyFailure(error);
        await writeRecord(
          opKey(op.id),
          {
            ...op,
            status: outcome.status,
            retries: op.retries + 1,
            nextRetryAt: Date.now() + retryDelay(op.retries),
            serverCode: error instanceof ApiError ? error.code : null,
            lastError: error instanceof Error ? error.message : 'Synchronisation interrompue.',
          },
          sending.revision,
        );
        changed++;
        if (outcome.stop) break;
      }
    }
  } finally {
    syncing = false;
  }
  return changed;
}

/** Nouvel essai explicite (après correction d'un conflit côté serveur, par exemple). */
export async function retryOperation(id: string) {
  const row = await readRecord<LocalOperation>(opKey(id));
  if (!row || row.value.status === 'SYNCHRONISE') return;
  await writeRecord(
    opKey(id),
    { ...row.value, status: 'EN_ATTENTE', retries: 0, nextRetryAt: 0, lastError: null },
    row.revision,
  );
}

/** Abandon volontaire d'une modification locale non synchronisée (confirmée dans l'interface). */
export async function discardOperation(id: string) {
  const row = await readRecord<LocalOperation>(opKey(id));
  if (!row || row.value.status === 'EN_COURS')
    throw new Error('Envoi en cours : réessayez dans un instant.');
  await deleteRecord(opKey(id));
}

/** Nettoyage des opérations confirmées depuis plus de 30 jours (jamais des autres). */
export async function pruneSynchronized(now = Date.now()) {
  for (const row of await listOperations())
    if (
      row.value.status === 'SYNCHRONISE' &&
      now - new Date(row.value.createdAt).getTime() > 30 * 86_400_000
    )
      await deleteRecord(opKey(row.value.id));
}
