import type { Metadata } from 'next';
import { EvaluationEditor } from './evaluation-editor';

export const metadata: Metadata = { title: 'Modifier un questionnaire' };

export default function EditEvaluationPage() {
  return <EvaluationEditor />;
}
