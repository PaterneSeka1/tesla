'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Smartphone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { lockVault } from '@/lib/offline/vault';
import { listAttempts } from '@/lib/offline/attempts';
import { listOperations } from '@/lib/offline/operations';
import { logout } from '@/lib/api/auth';
import { meQueryOptions } from '@/lib/api/auth';

/** Identité de l'utilisateur connecté et déconnexion (pied de la sidebar et du menu mobile). */
export function UserMenu() {
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

  return (
    <div className="space-y-3">
      <Link
        href="/appareil"
        className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-tesla-sable hover:bg-white/10 hover:text-white"
      >
        <Smartphone className="size-4 shrink-0" aria-hidden />
        Cet appareil
      </Link>
      <Link
        href="/compte"
        className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-tesla-sable hover:bg-white/10 hover:text-white"
      >
        <UserRound className="size-4 shrink-0" aria-hidden />
        Mon compte
      </Link>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {data.user.firstName} {data.user.lastName}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-white/40 bg-transparent text-inherit hover:bg-white/10 hover:text-white"
          onClick={() => void onLogout()}
          disabled={pending}
        >
          <LogOut aria-hidden />
          Déconnexion
        </Button>
      </div>
    </div>
  );
}
