'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { lockVault } from '@/lib/offline/vault';
import { listAttempts } from '@/lib/offline/attempts';
import { listOperations } from '@/lib/offline/operations';
import { logout } from '@/lib/api/auth';
import { meQueryOptions } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

/**
 * Identité de l'utilisateur connecté et déconnexion : pied de la sidebar (`dark`, fond bordeaux) ou
 * du menu « Plus » mobile (`light`, fond clair) ; `compact` = sidebar repliée (icônes seules).
 */
export function UserMenu({
  tone = 'dark',
  compact = false,
  onNavigate,
}: {
  tone?: 'dark' | 'light';
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { data } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!data) return null;

  const onLogout = async () => {
    const [copies, operations] = await Promise.all([
      listAttempts().catch(() => []),
      listOperations().catch(() => []),
    ]);
    if (
      [...copies, ...operations.map((row) => row.value)].some((a) => a.status !== 'SYNCHRONISE') &&
      !window.confirm(
        'Des réponses ou modifications ne sont pas encore synchronisées. Elles seront conservées chiffrées et verrouillées sur cet appareil ; gardez votre phrase locale pour les retrouver. Se déconnecter ?',
      )
    )
      return;
    lockVault();
    setPending(true);
    try {
      await logout();
    } finally {
      // Les données en cache (fiches, observations) ne doivent pas survivre à la session.
      queryClient.clear();
      router.replace('/connexion');
    }
  };

  const { firstName, lastName } = data.user;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const light = tone === 'light';
  const itemClass = cn(
    'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
    'focus-visible:ring-[3px] focus-visible:outline-none',
    light
      ? 'text-foreground hover:bg-muted focus-visible:ring-ring/50'
      : 'text-tesla-sable hover:bg-white/10 hover:text-white focus-visible:ring-tesla-or/60',
    compact && 'justify-center px-0',
  );

  if (compact)
    return (
      <div className="space-y-1">
        <Link href="/appareil" className={itemClass} aria-label="Cet appareil" title="Cet appareil">
          <Smartphone className="size-4 shrink-0" aria-hidden />
        </Link>
        <span
          role="img"
          aria-label={`${firstName} ${lastName}`}
          title={`${firstName} ${lastName}`}
          className="mx-auto grid size-9 place-items-center rounded-full bg-tesla-sable text-sm font-semibold text-tesla-bordeaux"
        >
          {initials}
        </span>
        <button
          type="button"
          className={itemClass}
          onClick={() => void onLogout()}
          disabled={pending}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    );

  return (
    <div className="space-y-1">
      <Link href="/appareil" className={itemClass} onClick={onNavigate}>
        <Smartphone className="size-4 shrink-0" aria-hidden />
        Cet appareil
      </Link>
      {/* Identité de la personne connectée : nom complet, jamais tronqué ni collé à un bouton. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-tesla-sable text-sm font-semibold text-tesla-bordeaux"
        >
          {initials}
        </span>
        <p
          className={cn(
            'min-w-0 text-sm leading-tight font-medium break-words',
            light ? 'text-foreground' : 'text-white',
          )}
        >
          {firstName} {lastName}
        </p>
      </div>
      <button
        type="button"
        className={itemClass}
        onClick={() => void onLogout()}
        disabled={pending}
      >
        <LogOut className="size-4" aria-hidden />
        {pending ? 'Déconnexion…' : 'Se déconnecter'}
      </button>
    </div>
  );
}
