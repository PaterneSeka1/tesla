import type { Metadata } from 'next';
import { EvaluationIntro } from './evaluation-intro';

export const metadata: Metadata = { title: 'Évaluation' };

export default function EvaluationPage() {
  return <EvaluationIntro />;
}
