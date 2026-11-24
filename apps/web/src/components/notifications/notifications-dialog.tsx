'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { markNotificationsRead, myNotificationsQueryOptions } from '@/lib/api/notifications';
import { userCan } from '@/lib/navigation';

/**
 * Fenêtre « Notifications » (D192) : s'ouvre à l'arrivée sur la plateforme lorsqu'il reste des
 * notifications non lues (rappels de rattrapage). « J'ai compris » les marque lues ; « Plus tard »
 * la ferme jusqu'au prochain chargement. Hors ligne : rien n'est affiché (aucune copie locale).
 */
export function NotificationsDialog() {
  const user = useSessionUser();
  const allowed = userCan(user, 'notification.own');
  const queryClient = useQueryClient();
  const { data } = useQuery({ ...myNotificationsQueryOptions, enabled: allowed });
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const items = data?.items ?? [];
  const open = allowed && !dismissed && items.length > 0;

  const acknowledge = async () => {
    setPending(true);
    try {
      await markNotificationsRead(items.map((item) => item.id));
      await queryClient.invalidateQueries({ queryKey: myNotificationsQueryOptions.queryKey });
    } catch {
      // Sans réseau ou en cas d'erreur : elles restent non lues et reviendront au prochain chargement.
    } finally {
      setPending(false);
      setDismissed(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            {items.length === 1
              ? 'Un rappel vous attend.'
              : `${items.length} rappels vous attendent.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50dvh] space-y-3 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.body}</p>
              {item.link && (
                <Link
                  href={item.link}
                  className="mt-1 inline-block text-tesla-bordeaux underline underline-offset-2"
                  onClick={() => setDismissed(true)}
                >
                  Voir
                </Link>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDismissed(true)} disabled={pending}>
            Plus tard
          </Button>
          <Button onClick={() => void acknowledge()} disabled={pending}>
            {pending ? 'Enregistrement…' : 'J’ai compris'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
