import type { Metadata } from 'next';
import { ResultReviewQueue } from './result-review-queue';

export const metadata: Metadata = { title: 'Résultats à examiner' };

export default function Page() {
  return <ResultReviewQueue />;
}
