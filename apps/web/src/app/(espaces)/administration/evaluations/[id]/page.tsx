import type { Metadata } from 'next';
import { EvaluationRevision } from './evaluation-revision';

export const metadata: Metadata = { title: 'Examen d’un questionnaire' };

export default function Page() {
  return <EvaluationRevision />;
}
