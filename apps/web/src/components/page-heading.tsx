'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { meQueryOptions } from '@/lib/api/auth';
import { findActiveItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Titre de page ; la description est réservée aux règles qui préviennent une erreur.
 * Sur mobile et tablette, l'en-tête affiche déjà l'entrée de menu active : un titre identique
 * n'est alors conservé que pour les lecteurs d'écran (aucun doublon visible).
 */
export function PageHeading({ title, description }: { title: string; description?: string }) {
  const pathname = usePathname();
  const user = useQuery(meQueryOptions).data?.user;
  const duplicated = user !== undefined && findActiveItem(user, pathname)?.label === title;
  return (
    <div className={cn('space-y-1', duplicated && !description && 'max-lg:contents')}>
      <h1
        className={cn(
          'text-2xl font-semibold tracking-tight text-tesla-bordeaux',
          duplicated && 'max-lg:sr-only',
        )}
      >
        {title}
      </h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
