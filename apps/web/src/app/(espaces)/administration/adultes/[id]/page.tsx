import type { Metadata } from 'next';
import { ScoutProfileView } from '../../routiers/[id]/scout-profile';

export const metadata: Metadata = { title: 'Fiche adulte' };

/** Même fiche que pour un routier, réduite à l'identité, au compte et aux évaluations (D185). */
export default function AdultPage() {
  return <ScoutProfileView />;
}
