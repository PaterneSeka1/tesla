import type { Metadata } from 'next';
import { ReviewQueue } from './review-queue';

export const metadata: Metadata = { title: 'Modules à valider' };

export default function ReviewQueuePage() {
  return <ReviewQueue />;
}
