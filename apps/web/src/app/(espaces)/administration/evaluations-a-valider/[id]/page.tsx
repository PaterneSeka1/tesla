import type { Metadata } from 'next';
import { ResultReview } from './result-review';

export const metadata: Metadata = { title: 'Examen d’un résultat' };

export default function Page() {
  return <ResultReview />;
}
