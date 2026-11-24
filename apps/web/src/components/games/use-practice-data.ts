'use client';

import { useQuery } from '@tanstack/react-query';
import { useSessionUser } from '@/components/auth/session-gate';
import { journalQueryOptions, practiceBankQueryOptions } from '@/lib/api/practice';
import { userCan } from '@/lib/navigation';

/**
 * Banque d'entraînement et carnet du compte. L'encadrement (aperçu) n'a pas de carnet : la
 * requête n'est pas envoyée. Les deux sont disponibles hors ligne après une première visite.
 */
export function usePracticeData() {
  const user = useSessionUser();
  const owns = userCan(user, 'practice.own');
  const bank = useQuery(practiceBankQueryOptions);
  const journal = useQuery({ ...journalQueryOptions, enabled: owns });
  return { bank, journal: owns ? journal : null, owns };
}

/** Graine du jour : les parties varient d'un jour à l'autre, de façon reproductible. */
export const todaySeed = () => new Date().toISOString().slice(0, 10);
