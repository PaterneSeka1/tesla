'use client';

import { useSyncExternalStore } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { feedback } from '@/lib/feedback';
import { userCan } from '@/lib/navigation';
import { resetOnboarding } from '@/lib/onboarding';
import { usePreferences, writePreferences } from '@/lib/preferences';

const noop = () => () => {};
/** La vibration n'est proposée que si l'appareil sait vibrer (aucun réglage factice). */
const useCanVibrate = () =>
  useSyncExternalStore(
    noop,
    () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    () => false,
  );

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full bg-muted transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-tesla-rouge"
      >
        <span
          aria-hidden
          className="absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 in-aria-checked:translate-x-5"
        />
      </button>
    </label>
  );
}

/**
 * Confort de cet appareil (D195) : animations, sons (désactivés par défaut), vibrations. Réglages
 * locaux, aucune donnée envoyée au serveur. Les jeux et retours restent compréhensibles sans son
 * ni vibration.
 */
export function ComfortSettings() {
  const user = useSessionUser();
  const preferences = usePreferences();
  const canVibrate = useCanVibrate();
  const toast = useToast();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confort</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Toggle
          label="Réduire les animations"
          checked={preferences.motion === 'reduced'}
          onChange={(value) => writePreferences({ motion: value ? 'reduced' : 'system' })}
        />
        <Toggle
          label="Sons de réussite"
          checked={preferences.sound}
          onChange={(value) => {
            writePreferences({ sound: value });
            if (value) feedback('success');
          }}
        />
        {canVibrate && (
          <Toggle
            label="Vibrations"
            checked={preferences.haptics}
            onChange={(value) => writePreferences({ haptics: value })}
          />
        )}
        {userCan(user, 'practice.own') && (
          <div className="pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3"
              onClick={() => {
                resetOnboarding();
                toast.info('La présentation s’affichera sur l’accueil.');
              }}
            >
              Revoir la présentation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
