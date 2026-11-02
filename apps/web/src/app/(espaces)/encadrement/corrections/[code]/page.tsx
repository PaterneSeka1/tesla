import type { Metadata } from 'next';
import { CorrectionCopy } from './correction-copy';

export const metadata: Metadata = { title: 'Copie' };

export default function CorrectionCopyPage() {
  return <CorrectionCopy />;
}
