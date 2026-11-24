import { HomeDashboard } from '@/components/home-dashboard';

/** Accueil : chaque bloc porte son propre titre (aucun titre « Accueil » répété). */
export default function Page() {
  return (
    <>
      <h1 className="sr-only">Accueil</h1>
      <HomeDashboard />
    </>
  );
}
