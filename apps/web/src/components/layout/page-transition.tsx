'use client';

import { usePathname } from 'next/navigation';

/**
 * Entrée de chaque page : ses blocs (titre, contenu) montent en cascade à chaque changement de
 * chemin. Les paramètres de recherche ne relancent pas l'animation (filtres, pagination).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="stagger space-y-6">
      {children}
    </div>
  );
}
