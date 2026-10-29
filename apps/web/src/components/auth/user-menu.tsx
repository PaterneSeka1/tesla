'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@tesla/shared';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/api/auth';
import { meQueryOptions } from '@/lib/api/auth';

/** Identité de l'utilisateur connecté et déconnexion. */
export function UserMenu() {
  const { data } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!data) return null;

  const onLogout = async () => {
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
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium">
          {data.user.firstName} {data.user.lastName}
        </p>
        <p className="text-xs opacity-80">{ROLE_LABELS[data.user.role]}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-white/40 bg-transparent text-inherit hover:bg-white/10 lg:border-border lg:hover:bg-muted"
        onClick={() => void onLogout()}
        disabled={pending}
      >
        <LogOut aria-hidden />
        <span className="sr-only sm:not-sr-only">Déconnexion</span>
      </Button>
    </div>
  );
}
