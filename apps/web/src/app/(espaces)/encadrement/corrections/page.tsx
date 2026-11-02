import type { Metadata } from 'next';
import { CorrectionQueue } from './correction-queue';

export const metadata: Metadata = { title: 'Copies' };

export default function CorrectionsPage() {
  return <CorrectionQueue />;
}
