import type { Metadata } from 'next';
import { CorrectionCopy } from './correction-copy';

export const metadata: Metadata = { title: 'Correction d’une copie' };

export default function CorrectionCopyPage() {
  return <CorrectionCopy />;
}
