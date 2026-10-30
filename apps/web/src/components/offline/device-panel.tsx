'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogModuleDetailSchema } from '@tesla/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meQueryOptions } from '@/lib/api/auth';
import { apiFetch } from '@/lib/api/client';
import {
  type LocalAttempt,
  listAttempts,
  SYNC_STATE_LABELS,
  syncAttempts,
} from '@/lib/offline/attempts';
import {
  type DownloadedModule,
  downloadModule,
  listDownloads,
  removeDownload,
} from '@/lib/offline/downloads';
import {
  discardOperation,
  listOperations,
  type LocalOperation,
  retryOperation,
  syncOperations,
} from '@/lib/offline/operations';
import {
  lastPreparation,
  prepareDevice,
  type PreparationReport,
  verifyPreparedPages,
} from '@/lib/offline/preparation';
import { ensureVaultRestored, hasVaultFor, lockVault, ownerId } from '@/lib/offline/vault';
import { DeviceUnlock } from './device-unlock';
import { useDeviceState } from './use-device-state';

const dateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR');

/**
 * Cet appareil : déverrouillage, préparation pour l'usage sans connexion, modifications en
 * attente et conflits, évaluations et modules conservés, stockage et confidentialité.
 * Les écrans habituels restent ceux de l'application : cette page ne sert qu'à leur gestion.
 */
export function DevicePanel() {
  const user = useSessionUser();
  const local = useQuery(meQueryOptions).data?.local === true;
  const queryClient = useQueryClient();
  const device = useDeviceState();
  const [exists, setExists] = useState(true);
  const [report, setReport] = useState<PreparationReport | null>(null);
  const [operations, setOperations] = useState<LocalOperation[]>([]);
  const [attempts, setAttempts] = useState<LocalAttempt[]>([]);
  const [downloads, setDownloads] = useState<DownloadedModule[]>([]);
  const [updates, setUpdates] = useState<string[]>([]);
  const [storage, setStorage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const unlocked = device.unlocked && ownerId() === user.id;

  const refresh = useCallback(async () => {
    await ensureVaultRestored();
    setExists(await hasVaultFor(user.id));
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage !== undefined)
      setStorage(
        `${Math.ceil(estimate.usage / 1024 / 1024)} Mo utilisés${estimate.quota ? ` sur ${Math.floor(estimate.quota / 1024 / 1024)} Mo disponibles` : ''}`,
      );
    if (ownerId() !== user.id) return;
    const [prep, ops, copies, modules] = await Promise.all([
      lastPreparation(),
      listOperations(),
      listAttempts(),
      listDownloads(),
    ]);
    setReport(prep);
    setOperations(ops.map((row) => row.value).filter((op) => op.status !== 'SYNCHRONISE'));
    setAttempts(copies);
    setDownloads(modules);
  }, [user.id]);

  useEffect(() => {
    const listener = () => {
      void refresh().catch((e: unknown) => setMessage(e instanceof Error ? e.message : ''));
    };
    listener();
    window.addEventListener('offline-data-change', listener);
    window.addEventListener('offline-vault-change', listener);
    return () => {
      window.removeEventListener('offline-data-change', listener);
      window.removeEventListener('offline-vault-change', listener);
    };
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const prepare = () =>
    run(async () => {
      const result = await prepareDevice(queryClient, user, setMessage);
      setMessage(
        result.ready
          ? 'Prêt pour une utilisation sans connexion.'
          : 'Préparation incomplète : voir le détail ci-dessous.',
      );
    });

  const verify = () =>
    run(async () => {
      const missing = await verifyPreparedPages();
      setMessage(
        missing === null
          ? 'Aucune préparation enregistrée.'
          : missing.length === 0
            ? 'Toutes les pages préparées sont présentes sur cet appareil.'
            : `${missing.length} page(s) ne sont plus présentes : préparez à nouveau avec Internet.`,
      );
    });

  const checkUpdates = () =>
    run(async () => {
      const newer: string[] = [];
      for (const item of downloads) {
        const slug = item.package.content.slug;
        const current = await apiFetch(
          `/modules/${encodeURIComponent(slug)}`,
          catalogModuleDetailSchema,
        );
        if (current.version !== item.package.content.version) newer.push(slug);
      }
      setUpdates(newer);
      setMessage(newer.length ? 'Nouvelles versions disponibles.' : 'Modules à jour.');
    });

  return (
    <>
      <PageHeading title="Cet appareil" />

      {!unlocked ? (
        <Card>
          <CardHeader>
            <CardTitle>{exists ? 'Déverrouiller' : 'Utiliser Tesla sans connexion'}</CardTitle>
          </CardHeader>
          <CardContent>
            <DeviceUnlock user={local ? undefined : user} create={!exists && !local} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Préparation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {report ? (
                <div className="space-y-1">
                  <p className="font-medium">
                    {report.ready
                      ? 'Prêt pour une utilisation sans connexion'
                      : 'Préparation incomplète'}{' '}
                    · {dateTime(report.preparedAt)}
                  </p>
                  {report.dataFailures.length > 0 && (
                    <p>Données non téléchargées : {report.dataFailures.join(', ')}.</p>
                  )}
                  {report.missingPages.length > 0 && (
                    <p>{report.missingPages.length} page(s) non disponibles sans connexion.</p>
                  )}
                </div>
              ) : (
                <p>
                  Cet appareil n’est pas encore préparé. La préparation télécharge vos données
                  autorisées et les pages de l’application ; elle nécessite Internet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !device.online || local} onClick={() => void prepare()}>
                  {report ? 'Mettre à jour la préparation' : 'Préparer cet appareil'}
                </Button>
                {report && (
                  <Button variant="outline" disabled={busy} onClick={() => void verify()}>
                    Vérifier
                  </Button>
                )}
                <Button variant="outline" onClick={() => lockVault()}>
                  Verrouiller
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modifications en attente ({operations.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {operations.length === 0 ? (
                <p className="text-muted-foreground">Tout est synchronisé.</p>
              ) : (
                <ul className="space-y-2">
                  {operations.map((op) => (
                    <li key={op.id} className="space-y-1 rounded-md border p-3">
                      <p className="font-medium">{op.label}</p>
                      <p>
                        {SYNC_STATE_LABELS[op.status]} · saisie le {dateTime(op.createdAt)}
                      </p>
                      {op.lastError && <p role="alert">{op.lastError}</p>}
                      {['CONFLIT', 'REJETE'].includes(op.status) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !device.online}
                            onClick={() =>
                              void run(async () => {
                                await retryOperation(op.id);
                                await syncOperations(true);
                                await queryClient.invalidateQueries();
                              })
                            }
                          >
                            Réessayer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Abandonner définitivement cette modification ? Elle sera supprimée de cet appareil sans être envoyée.',
                                )
                              )
                                void run(() => discardOperation(op.id));
                            }}
                          >
                            Abandonner
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                disabled={busy || !device.online || local}
                onClick={() =>
                  void run(async () => {
                    await syncAttempts(true);
                    if ((await syncOperations(true)) > 0) await queryClient.invalidateQueries();
                    setMessage('Synchronisation terminée.');
                  })
                }
              >
                Synchroniser maintenant
              </Button>
            </CardContent>
          </Card>

          {(user.role === 'ROUTIER' || attempts.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Évaluations sur cet appareil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {attempts.length === 0 && (
                  <p className="text-muted-foreground">
                    Aucune. Depuis une évaluation, choisissez « Préparer pour passer sans connexion
                    ».
                  </p>
                )}
                {attempts.map((a) => (
                  <div key={a.package.session.id} className="rounded-md border p-3">
                    <Link
                      className="font-medium underline"
                      href={`/evaluations/${a.package.session.evaluation.id}/passer`}
                    >
                      {a.package.session.evaluation.title} · {a.package.session.code}
                    </Link>
                    <p>
                      {SYNC_STATE_LABELS[a.status]}
                      {a.status === 'LOCAL' &&
                        ` · à remettre et synchroniser avant le ${dateTime(a.package.expiresAt)}`}
                    </p>
                    {a.lastError && <p role="alert">{a.lastError}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Modules avec images ({downloads.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {downloads.length === 0 && (
                <p className="text-muted-foreground">
                  Le texte des modules est préparé avec l’appareil. Pour lire aussi les images sans
                  connexion, ouvrez un module et choisissez « Télécharger avec les images ».
                </p>
              )}
              {downloads.map((m) => (
                <div
                  key={m.package.content.slug}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                >
                  <Link className="underline" href={`/modules/${m.package.content.slug}`}>
                    {m.package.content.title} · v{m.package.content.version}
                  </Link>
                  {updates.includes(m.package.content.slug) && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Remplacer la version téléchargée ?'))
                          void run(() => downloadModule(m.package.content.slug, setMessage));
                      }}
                    >
                      Mettre à jour
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Supprimer les images de ce module de cet appareil ?'))
                        void run(() => removeDownload(m.package.content.slug));
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              ))}
              {downloads.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !device.online || local}
                  onClick={() => void checkUpdates()}
                >
                  Vérifier les versions
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {message && (
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stockage et confidentialité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {storage && <p>{storage}.</p>}
          <p>
            Les données sont chiffrées sur cet appareil avec votre phrase locale, jamais transmise.
            Le déverrouillage dure 12 heures au plus ; verrouillez avant de prêter l’appareil.
          </p>
          <p>
            Sans nouvelle connexion pendant 14 jours, les données restent chiffrées mais ne sont
            plus affichées. Les modifications non synchronisées ne sont jamais supprimées
            automatiquement : n’effacez pas les données du navigateur avant leur synchronisation.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void run(async () => {
                const granted = await navigator.storage?.persist?.();
                setMessage(
                  granted
                    ? 'Conservation durable accordée par le navigateur.'
                    : 'Conservation durable non accordée par ce navigateur.',
                );
              })
            }
          >
            Demander la conservation durable
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
