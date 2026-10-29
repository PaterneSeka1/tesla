import type { Metadata } from 'next';
import { NewEvaluation } from './new-evaluation';

export const metadata: Metadata = { title: 'Nouveau questionnaire' };

export default function NewEvaluationPage() {
  return <NewEvaluation />;
}
