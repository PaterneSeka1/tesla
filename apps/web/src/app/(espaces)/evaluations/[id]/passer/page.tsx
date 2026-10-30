import type { Metadata } from 'next';
import { PassEvaluation } from './pass-evaluation';

export const metadata: Metadata = { title: 'Passer l’évaluation' };

export default function TakeEvaluationPage() {
  return <PassEvaluation />;
}
