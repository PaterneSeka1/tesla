'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type SessionUser } from '@tesla/shared';
import { useState } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { meQueryOptions } from '@/lib/api/auth';
import { unlockVault } from '@/lib/offline/vault';

/**
 * Déverrouillage (ou activation) du coffre de cet appareil par la phrase locale, distincte du mot
 * de passe et jamais transmise. En ligne, `user` est le compte vérifié par le serveur ; hors
 * connexion, la phrase désigne elle-même le coffre (aucune liste de comptes affichée).
 */
export function DeviceUnlock({
  user,
  create = false,
  onUnlocked,
}: {
  user?: SessionUser;
  create?: boolean;
  onUnlocked?: () => void;
}) {
  const queryClient = useQueryClient();
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        unlockVault(phrase, user)
          .then(async () => {
            setPhrase('');
            await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
            onUnlocked?.();
          })
          .catch((e: unknown) =>
            setError(e instanceof Error ? e.message : 'Déverrouillage impossible.'),
          )
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-sm">
        {create
          ? 'Choisissez une phrase locale (12 caractères minimum), différente de votre mot de passe. Elle protège les données conservées sur cet appareil et ne peut pas être récupérée.'
          : 'Saisissez la phrase locale de cet appareil.'}
      </p>
      <label htmlFor="device-phrase" className="block text-sm font-medium">
        Phrase de déverrouillage locale
      </label>
      <PasswordInput
        id="device-phrase"
        autoComplete="off"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        required
        minLength={create ? 12 : 1}
        aria-invalid={!!error}
        aria-describedby={error ? 'device-phrase-error' : undefined}
      />
      {error && (
        <p id="device-phrase-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy || phrase.length === 0}>
        {create ? 'Activer sur cet appareil' : 'Déverrouiller'}
      </Button>
    </form>
  );
}
