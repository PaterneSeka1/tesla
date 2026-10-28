import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Logo de la Communauté Nikola Tesla (fichier fourni par la communauté). */
export function BrandLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-communaute.png"
      alt="Logo de la Communauté Nikola Tesla — District Requin de Sable, Abidjan"
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      priority
    />
  );
}
