'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { meQueryOptions } from '@/lib/api/auth';
import { legacyVaultExists, unlockOffline } from '@/lib/offline/vault';

/** Attente imposée entre deux essais après des échecs (ms) ; gêne seulement la saisie manuelle. */
export const unlockDelay = (failures: number) =>
  failures < 3 ? 0 : Math.min(30_000, 1000 * 2 ** (failures - 3));

/**
 * Déverrouillage **local** sans connexion (D180) : le mot de passe habituel du compte ouvre les
 * données préparées sur cet appareil. Rien n'est envoyé au serveur ; aucune liste de comptes n'est
 * affichée (le mot de passe désigne lui-même le coffre). Un appareil préparé avant la mise à jour
 * s'ouvre encore avec son ancienne phrase locale.
 */
export function DeviceUnlock({ onUnlocked }: { onUnlocked?: () => void }) {
  const queryClient = useQueryClient();
  const id = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [legacy, setLegacy] = useState(false);

  useEffect(() => {
    void legacyVaultExists()
      .then(setLegacy)
      .catch(() => setLegacy(false));
  }, []);
  useEffect(() => {
    if (waitUntil <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), 500);
    return () => clearTimeout(timer);
  }, [waitUntil, now]);
  const waiting = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (waiting > 0) return;
        setBusy(true);
        setError('');
        unlockOffline(password)
          .then(async () => {
            setPassword('');
            setFailures(0);
            await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
            onUnlocked?.();
          })
          .catch((e: unknown) => {
            const next = failures + 1;
            setFailures(next);
            setWaitUntil(Date.now() + unlockDelay(next));
            setNow(Date.now());
            setError(e instanceof Error ? e.message : 'Déverrouillage impossible.');
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="flex items-center gap-2 font-medium">
        <CloudOff className="size-4 shrink-0" aria-hidden />
        Vous utilisez Nikola Tesla Académie hors ligne.
      </p>
      <p className="text-sm text-muted-foreground">
        Saisissez votre mot de passe habituel pour ouvrir les contenus préparés sur cet appareil.
      </p>
      <label htmlFor={`${id}-password`} className="block text-sm font-medium">
        Mot de passe
      </label>
      <PasswordInput
        id={`${id}-password`}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      />
      {error ? (
        <div id={`${id}-error`} role="alert" className="space-y-1 text-sm text-destructive">
          <p>{error}</p>
          <p className="text-foreground">
            Mot de passe changé récemment sur un autre appareil ? Celui-ci ne le saura qu’à la
            prochaine connexion avec Internet : saisissez l’ancien.
          </p>
        </div>
      ) : (
        legacy && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            Appareil préparé avant la mise à jour : saisissez votre ancienne phrase locale. À la
            prochaine connexion avec Internet, votre mot de passe la remplacera.
          </p>
        )
      )}
      <Button disabled={busy || password.length === 0 || waiting > 0}>
        {busy ? 'Ouverture…' : waiting > 0 ? `Patientez ${waiting} s` : 'Ouvrir mon espace'}
      </Button>
    </form>
  );
}
