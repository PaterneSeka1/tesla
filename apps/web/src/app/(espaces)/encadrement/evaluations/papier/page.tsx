import type { Metadata } from 'next';
import { PaperPreparation } from './paper-preparation';

export const metadata: Metadata = { title: 'Évaluation papier' };

export default function PaperEvaluationPage() {
  return <PaperPreparation />;
}
