import type { Metadata } from 'next';
import { TakeEvaluation } from './take-evaluation';

export const metadata: Metadata = { title: 'Passer l’évaluation' };

export default function TakeEvaluationPage() {
  return <TakeEvaluation />;
}
