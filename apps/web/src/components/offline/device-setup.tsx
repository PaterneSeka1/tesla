'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type SessionUser } from '@tesla/shared';
import { useEffect, useId, useState } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, meQueryOptions } from '@/lib/api/auth';
import {
  convertLegacyVault,
  createVault,
  openVaultAfterLogin,
  openVaultOnline,
  type VaultState,
} from '@/lib/offline/vault';

/**
 * Vérifie le mot de passe auprès du serveur avant de s'en servir pour protéger le coffre (une faute
 * de frappe rendrait l'appareil inutilisable hors connexion). Même contrôle et mêmes limites que la
 * connexion ; le mot de passe n'est conservé nulle part.
 */
async function verifyAccountPassword(user: SessionUser, password: string) {
  const me = await login({ email: user.email, password });
  if (me.user.id !== user.id) throw new Error('Ce mot de passe correspond à un autre compte.');
}

/**
 * Cet appareil, en ligne et coffre fermé (D180) :
 * - `none` : préparer l'appareil avec le mot de passe habituel (appareil personnel) ;
 * - `ready` : ouverture automatique (clé de l'appareil), sinon par le mot de passe ;
 * - `legacy` : conversion unique de l'ancienne phrase locale ;
 * - `revoked` : appareil retiré du compte, effacement proposé (voir `ForgottenSecret`).
 */
export function DeviceSetup({
  user,
  state,
  onReady,
}: {
  user: SessionUser;
  state: VaultState;
  onReady: (created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const id = useId();
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  // Coffre prêt mais fermé : ouverture silencieuse par la clé de l'appareil (session valide).
  useEffect(() => {
    if (state !== 'ready' || autoTried) return;
    void openVaultOnline(user)
      .then((opened) => opened && onReady(false))
      .finally(() => setAutoTried(true));
  }, [state, autoTried, user, onReady]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await verifyAccountPassword(user, password);
      if (state === 'none') await createVault(user, password);
      else if (state === 'legacy') await convertLegacyVault(user, phrase, password);
      else {
        const result = await openVaultAfterLogin(user, password);
        if (result === 'revoked' || result === 'unrecoverable')
          throw new Error('Les données de cet appareil ne peuvent plus être ouvertes.');
      }
      setPassword('');
      setPhrase('');
      await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      onReady(state === 'none');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'revoked') return null;
  if (state === 'ready' && !autoTried) {
    return <p className="text-sm text-muted-foreground">Ouverture des données de cet appareil…</p>;
  }

  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {state === 'none' && (
        <p className="text-sm">
          Préparez cet appareil pour consulter vos cours et vos données sans Internet. Vous
          l’ouvrirez ensuite avec <strong>votre mot de passe habituel</strong>, même hors connexion.
          À faire uniquement sur un appareil personnel.
        </p>
      )}
      {state === 'legacy' && (
        <>
          <p className="text-sm">
            Cet appareil a été préparé avec une phrase locale. Saisissez-la une dernière fois :
            ensuite, seul votre mot de passe habituel sera demandé. Vos données locales sont
            conservées.
          </p>
          <label htmlFor={`${id}-phrase`} className="block text-sm font-medium">
            Ancienne phrase locale
          </label>
          <PasswordInput
            id={`${id}-phrase`}
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            required
          />
        </>
      )}
      {state === 'ready' && (
        <p className="text-sm">
          Confirmez votre mot de passe pour ouvrir les données de cet appareil.
        </p>
      )}
      {/* Champ d'identifiant masqué : aide les gestionnaires de mots de passe. */}
      <Input type="email" autoComplete="username" value={user.email} readOnly hidden />
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
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy || !password || (state === 'legacy' && !phrase)}>
        {busy
          ? 'Patientez…'
          : state === 'none'
            ? 'Préparer cet appareil'
            : state === 'legacy'
              ? 'Utiliser mon mot de passe'
              : 'Ouvrir'}
      </Button>
    </form>
  );
}
