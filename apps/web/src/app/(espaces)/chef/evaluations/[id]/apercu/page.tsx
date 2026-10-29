import type { Metadata } from 'next';
import { EvaluationPreview } from './evaluation-preview';

export const metadata: Metadata = { title: 'Aperçu du questionnaire' };

export default function EvaluationPreviewPage() {
  return <EvaluationPreview />;
}
