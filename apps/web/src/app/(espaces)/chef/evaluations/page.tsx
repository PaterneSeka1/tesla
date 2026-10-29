import type { Metadata } from 'next';
import { EvaluationList } from '@/components/evaluations/evaluation-list';

export const metadata: Metadata = { title: 'Évaluations' };

export default function ChefEvaluationsPage() {
  return <EvaluationList />;
}
