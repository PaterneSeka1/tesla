import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Logo de la Communauté Nikola Tesla (fichier fourni par la communauté). Servi tel quel
 * (`unoptimized`) : le service worker le précharge sous cette seule adresse, il s'affiche donc hors
 * ligne à toutes les tailles (l'optimiseur produirait une URL `/_next/image` par taille, absente du
 * cache tant qu'elle n'a pas été affichée en ligne).
 */
export function BrandLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-communaute.png"
      alt="Logo de la Communauté Nikola Tesla — District Requin de Sable, Abidjan"
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      unoptimized
      priority
    />
  );
}
