'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { OfflineAttempt } from './offline-attempt';
import { OfflineReader } from './offline-reader';
import {
  type LocalAttempt,
  listAttempts,
  prepareEvaluation,
  SYNC_STATE_LABELS,
  syncAttempts,
} from '@/lib/offline/attempts';
import {
  type DownloadedModule,
  downloadModule,
  listDownloads,
  removeDownload,
} from '@/lib/offline/downloads';
import { lockVault, ownerId, unlockVault, vaultExists } from '@/lib/offline/vault';
import { apiFetch } from '@/lib/api/client';
import { catalogModuleDetailSchema } from '@tesla/shared';

/** Coquille publique générique : aucune donnée de compte dans le HTML préchargé. */
export function OfflineHub({ prepareId }: { prepareId?: string }) {
  const [unlocked, setUnlocked] = useState(false);
  const [exists, setExists] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [online, setOnline] = useState(true);
  const [downloads, setDownloads] = useState<DownloadedModule[]>([]);
  const [attempts, setAttempts] = useState<LocalAttempt[]>([]);
  const [selection, setSelection] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState('Estimation du stockage indisponible.');
  const [updates, setUpdates] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    if (!ownerId()) return;
    const [modules, copies] = await Promise.all([listDownloads(), listAttempts()]);
    if (!ownerId()) return;
    setDownloads(modules);
    setAttempts(copies);
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage !== undefined)
      setStorage(
        `${Math.ceil(estimate.usage / 1024 / 1024)} Mo utilisés par ce site${estimate.quota ? ` / ${Math.floor(estimate.quota / 1024 / 1024)} Mo estimés` : ''}.`,
      );
  }, []);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        await refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Opération impossible.');
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    const changed = () => {
      const open = !!ownerId();
      setUnlocked(open);
      if (!open) {
        setDownloads([]);
        setAttempts([]);
        setSelection('');
        setUpdates([]);
      } else void refresh().catch((e) => setMessage(e.message));
    };
    const hash = () => setSelection(decodeURIComponent(location.hash.slice(1)));
    const connection = () => {
      queueMicrotask(() => setOnline(navigator.onLine));
      if (navigator.onLine && ownerId())
        void syncAttempts()
          .then(refresh)
          .catch((e) => setMessage(e.message));
    };
    const focus = () => {
      if (document.visibilityState === 'visible') connection();
    };
    changed();
    hash();
    queueMicrotask(() => setOnline(navigator.onLine));
    void vaultExists()
      .then(setExists)
      .catch((e) => setMessage(e.message));
    window.addEventListener('hashchange', hash);
    window.addEventListener('offline-vault-change', changed);
    window.addEventListener('offline-data-change', changed);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    document.addEventListener('visibilitychange', focus);
    // Réessais bornés à six envois par opération ; arrêt automatique au verrouillage.

    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('offline-vault-change', changed);
      window.removeEventListener('offline-data-change', changed);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [refresh]);
  async function unlock() {
    await unlockVault(phrase);
    setPhrase('');
    setExists(true);
    setMessage('Données locales déverrouillées.');
    // Une absence de session ne bloque pas la lecture locale ; elle bloque les envois.
    if (navigator.onLine) await syncAttempts();
  }
  async function checkUpdates() {
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
    setMessage(
      newer.length
        ? 'Mises à jour disponibles. Téléchargez-les explicitement.'
        : 'Vos versions téléchargées sont à jour.',
    );
  }
  const pending = attempts.filter((a) => !['LOCAL', 'SYNCHRONISE'].includes(a.status)).length;
  return (
    <div className="space-y-5">
      <PageHeading title="Hors ligne" />
      <p role="status">
        {online ? 'Réseau disponible' : 'Hors ligne'} · {pending} copie(s) à synchroniser ou
        résoudre
      </p>
      {!unlocked ? (
        <form
          className="max-w-lg space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(unlock);
          }}
        >
          <p>
            {exists
              ? 'Déverrouillez les données conservées sur cet appareil.'
              : 'Créez une phrase locale, distincte de votre mot de passe (12 caractères minimum).'}
          </p>
          <label htmlFor="offline-phrase">Phrase de déverrouillage locale</label>
          <PasswordInput
            id="offline-phrase"
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            required
            minLength={exists ? 1 : 12}
          />
          <Button disabled={busy}>{exists ? 'Déverrouiller' : 'Activer sur cet appareil'}</Button>
          <p className="text-sm">
            Une phrase oubliée ne peut pas être récupérée. Un seul compte par coffre local ;
            utilisez un profil de navigateur distinct pour un autre compte.
          </p>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => lockVault()}>
              Verrouiller
            </Button>
            <Button
              disabled={busy || !online}
              onClick={() =>
                void run(async () => {
                  await syncAttempts(true);
                  setMessage('Synchronisation terminée. Vérifiez chaque statut ci-dessous.');
                })
              }
            >
              Synchroniser maintenant
            </Button>
            <Button
              variant="outline"
              disabled={busy || !online}
              onClick={() => void run(checkUpdates)}
            >
              Vérifier les versions
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void run(async () => {
                  const granted = await navigator.storage?.persist?.();
                  setMessage(
                    granted
                      ? 'Conservation persistante accordée par ce navigateur.'
                      : 'Persistance non accordée ou indisponible.',
                  );
                })
              }
            >
              Demander la conservation locale
            </Button>
          </div>
          {prepareId && (
            <section className="space-y-3 rounded border p-4">
              <h2 className="font-semibold">Préparer cette évaluation</h2>
              <p>
                Une tentative est réservée pendant 24 heures : vos réponses doivent être
                synchronisées dans ce délai.
              </p>
              <Button
                disabled={busy || !online}
                onClick={() =>
                  void run(async () => {
                    const id = await prepareEvaluation(prepareId);
                    // Rechargement volontaire : la coquille publique reste accessible sans session ni réseau.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign(`/hors-ligne#attempt:${id}`);
                  })
                }
              >
                Vérifier mes droits et préparer
              </Button>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Téléchargements ({downloads.length})</h2>
            <p>
              {storage} ·{' '}
              {Math.ceil(downloads.reduce((sum, m) => sum + m.estimatedBytes, 0) / 1024)} Ko
            </p>
            {downloads.length === 0 && (
              <p>Aucun module téléchargé. Ouvrez un module en ligne pour le télécharger.</p>
            )}
            {downloads.map((m) => (
              <div
                key={m.package.content.slug}
                className="flex flex-wrap items-center gap-3 rounded border p-3"
              >
                <a className="underline" href={`/hors-ligne#module:${m.package.content.slug}`}>
                  {m.package.content.title} · v{m.package.content.version}
                </a>
                {updates.includes(m.package.content.slug) && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Remplacer explicitement la version téléchargée ?'))
                        void run(() => downloadModule(m.package.content.slug, setMessage));
                    }}
                  >
                    Mise à jour disponible
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Supprimer ce module local ? Les tentatives seront conservées.'))
                      void run(() => removeDownload(m.package.content.slug));
                  }}
                >
                  Supprimer localement
                </Button>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Tentatives</h2>
            {attempts.length === 0 && <p>Aucune évaluation préparée sur cet appareil.</p>}
            {attempts.map((a) => (
              <div key={a.package.session.id} className="rounded border p-3">
                <a className="underline" href={`/hors-ligne#attempt:${a.package.session.id}`}>
                  {a.package.session.evaluation.title} · {a.package.session.code}
                </a>
                <p>
                  {SYNC_STATE_LABELS[a.status]}
                  {a.retries > 0 && ` · ${a.retries} envoi(s) échoué(s)`}
                </p>
                {a.server?.decidedAt && (
                  <p>Traitée le {new Date(a.server.decidedAt).toLocaleString('fr-FR')}</p>
                )}
                {a.lastError && (
                  <p role="alert">
                    {a.lastError} Conservez cette copie et contactez un chef si nécessaire.
                  </p>
                )}
              </div>
            ))}
          </section>
          {selection.startsWith('module:') && (
            <OfflineReader key={selection} slug={selection.slice(7)} />
          )}
          {selection.startsWith('attempt:') && (
            <OfflineAttempt key={selection} id={selection.slice(8)} />
          )}
        </>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      <section className="space-y-2 rounded border p-4 text-sm text-muted-foreground">
        <h2 className="font-semibold">Confidentialité</h2>
        <p>
          Contenus et réponses sont chiffrés sur cet appareil ; la phrase locale n’est jamais
          transmise. Verrouillez avant de prêter votre appareil.
        </p>
        <p>
          N’effacez pas les données du navigateur et ne désinstallez pas l’application avant la
          synchronisation de vos copies.
        </p>
        <p>Vidéos et ressources externes ne sont pas disponibles hors ligne.</p>
      </section>
      <div className="flex flex-wrap gap-4">
        <Link href="/modules" className="underline">
          Bibliothèque
        </Link>
        <Link href="/evaluations" className="underline">
          Évaluations
        </Link>
        <Link href="/mes-resultats" className="underline">
          Résultats
        </Link>
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}
