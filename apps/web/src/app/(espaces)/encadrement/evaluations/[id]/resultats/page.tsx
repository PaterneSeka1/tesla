import type { Metadata } from 'next';
import { EvaluationResultsView } from './evaluation-results';

export const metadata: Metadata = { title: 'Résultats du questionnaire' };

export default function EvaluationResultsPage() {
  return <EvaluationResultsView />;
}
