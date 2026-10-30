import type { Metadata } from 'next';
import { PrepareEvaluation } from './prepare-evaluation';

export const metadata: Metadata = { title: 'Passer sans connexion' };

export default function Page() {
  return <PrepareEvaluation />;
}
