import type { Metadata } from 'next';
import { AvailableEvaluations } from './available-evaluations';

export const metadata: Metadata = { title: 'Évaluations' };

export default function EvaluationsPage() {
  return <AvailableEvaluations />;
}
