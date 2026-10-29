import type { Metadata } from 'next';
import { CorrectionQueue } from './correction-queue';

export const metadata: Metadata = { title: 'Corrections' };

export default function CorrectionsPage() {
  return <CorrectionQueue />;
}
