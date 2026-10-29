import type { Metadata } from 'next';
import { PaperAttempt } from './paper-attempt';

export const metadata: Metadata = { title: 'Tentative papier' };

export default function PaperAttemptPage() {
  return <PaperAttempt />;
}
