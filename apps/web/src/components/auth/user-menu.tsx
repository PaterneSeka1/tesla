'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { lockVault } from '@/lib/offline/vault';
import { listAttempts } from '@/lib/offline/attempts';
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
    const copies = await listAttempts().catch(() => []);
    if (
      copies.some((a) => a.status !== 'SYNCHRONISE') &&
      !window.confirm(
        'Des réponses restent sur cet appareil. Elles seront conservées chiffrées et verrouillées ; gardez votre phrase locale pour les retrouver. Se déconnecter ?',
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
  );
}
