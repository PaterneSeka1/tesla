import type { Metadata } from 'next';
import { PassEvaluation } from '../passer/pass-evaluation';

export const metadata: Metadata = { title: 'Évaluation en mode jeu' };

/** Mode jeu à paliers (D140) : même tentative et même correction que la passation classique. */
export default function PalierGamePage() {
  return <PassEvaluation variant="paliers" />;
}
