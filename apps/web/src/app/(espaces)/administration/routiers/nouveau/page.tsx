import type { Metadata } from 'next';
import { NewScout } from './new-scout';

export const metadata: Metadata = { title: 'Nouveau routier' };

export default function NewScoutPage() {
  return <NewScout />;
}
