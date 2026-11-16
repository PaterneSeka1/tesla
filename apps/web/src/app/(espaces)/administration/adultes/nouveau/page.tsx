import type { Metadata } from 'next';
import { NewAdult } from './new-adult';

export const metadata: Metadata = { title: 'Nouvel adulte' };

export default function NewAdultPage() {
  return <NewAdult />;
}
