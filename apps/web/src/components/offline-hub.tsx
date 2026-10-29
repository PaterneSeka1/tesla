'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { OfflineAttempt } from './offline-attempt';
import { OfflineReader } from './offline-reader';
import {
  type LocalAttempt,
  listAttempts,
  prepareEvaluation,
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
      <h1 className="text-2xl font-semibold">Mes contenus hors ligne</h1>
      <p role="status">
        {online ? 'Réseau détecté (réception serveur à confirmer)' : 'Mode hors ligne'} · {pending}{' '}
        copie(s) à synchroniser ou résoudre
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
              : 'Connectez-vous en tant que routier, puis créez une phrase locale distincte du mot de passe du compte (12 caractères minimum).'}
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
                  setMessage(
                    'Vérification des remises terminée. Consultez chaque statut ci-dessous.',
                  );
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
                L’autorisation réserve une tentative pendant 24 heures. Les réponses doivent
                parvenir au serveur dans ce délai. Les droits seront revérifiés.
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
              {storage} · Contenus :{' '}
              {Math.ceil(downloads.reduce((sum, m) => sum + m.estimatedBytes, 0) / 1024)} Ko estimés
              avant chiffrement.
            </p>
            {downloads.length === 0 && (
              <p>
                Aucun module disponible hors ligne. Ouvrez un module en ligne pour le télécharger.
              </p>
            )}
            {downloads.map((m) => (
              <div
                key={m.package.content.slug}
                className="flex flex-wrap items-center gap-3 rounded border p-3"
              >
                <a className="underline" href={`/hors-ligne#module:${m.package.content.slug}`}>
                  {m.package.content.title} · v{m.package.content.version} · disponible hors ligne
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
            <h2 className="text-xl font-semibold">Tentatives et synchronisation</h2>
            {attempts.length === 0 && <p>Aucune évaluation préparée sur cet appareil.</p>}
            {attempts.map((a) => (
              <div key={a.package.session.id} className="rounded border p-3">
                <a className="underline" href={`/hors-ligne#attempt:${a.package.session.id}`}>
                  {a.package.session.evaluation.title} · {a.package.session.code}
                </a>
                <p>
                  {a.status} · {a.retries} envoi(s) échoué(s)
                </p>
                {a.server?.decidedAt && (
                  <p>Décision serveur : {new Date(a.server.decidedAt).toLocaleString('fr-FR')}</p>
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
        <h2 className="font-semibold">Confidentialité et conservation</h2>
        <p>
          Le texte, les images et vos réponses sont chiffrés sur cet appareil (AES-GCM). La phrase
          locale n’est pas envoyée au serveur. Verrouillez avant de partager votre appareil. Un
          appareil ou une application compromis peut accéder aux données pendant le déverrouillage.
        </p>
        <p>
          Le navigateur peut effacer les données locales. N’effacez pas le stockage et ne
          désinstallez pas l’application avant confirmation de synchronisation. Les copies rejetées
          restent conservées. Aucune réponse n’est supprimée pour libérer de l’espace.
        </p>
        <p>
          Les ressources externes et vidéos restent indisponibles hors ligne. Installation :
          utilisez « Installer l’application » si proposé par le navigateur ; sur iOS, le menu de
          partage peut proposer « Sur l’écran d’accueil ». La prise en charge dépend du navigateur.
        </p>
      </section>
      <div className="flex flex-wrap gap-4">
        <Link href="/modules" className="underline">
          Bibliothèque en ligne
        </Link>
        <Link href="/evaluations" className="underline">
          Évaluations
        </Link>
        <Link href="/mes-resultats" className="underline">
          Résultats officiels
        </Link>
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}
