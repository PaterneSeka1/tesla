import type { Metadata } from 'next';
import { EvaluationsAdmin } from './evaluations-admin';

export const metadata: Metadata = { title: 'Questionnaires' };

export default function Page() {
  return <EvaluationsAdmin />;
}
