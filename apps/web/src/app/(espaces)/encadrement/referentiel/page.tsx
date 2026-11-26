import type { Metadata } from 'next';
import { ReferenceManager } from './reference-manager';

export const metadata: Metadata = { title: 'Rubriques du référentiel' };

export default function ReferenceManagerPage() {
  return <ReferenceManager />;
}
