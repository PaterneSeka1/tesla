import { cn } from '@/lib/utils';

/**
 * Fond décoratif des bandeaux de marque (accueil, connexion) : halos lumineux qui dérivent
 * lentement, en rappel de l'électricité de Nikola Tesla. Purement visuel (`aria-hidden`).
 */
export function BrandBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <span className="absolute -top-24 -left-24 size-80 rounded-full bg-tesla-or/25 blur-3xl animate-drift" />
      <span className="absolute -right-20 -bottom-28 size-96 rounded-full bg-tesla-rouge/60 blur-3xl animate-drift [animation-delay:-7s]" />
      <span className="absolute top-1/3 left-1/2 size-56 rounded-full bg-tesla-or/10 blur-2xl animate-drift [animation-delay:-3s]" />
    </div>
  );
}

/** Courbe de transition entre un bandeau bordeaux et le fond de page. */
export function BrandCurve({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={cn('block h-8 w-full fill-background sm:h-12', className)}
      aria-hidden
    >
      <path d="M0 80V40C240 0 480 0 720 24s480 48 720 8v48z" />
    </svg>
  );
}
