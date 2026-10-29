import type { Metadata } from 'next';
import { ScoutProfileView } from './scout-profile';

export const metadata: Metadata = { title: 'Fiche routier' };

export default function ScoutPage() {
  return <ScoutProfileView />;
}
