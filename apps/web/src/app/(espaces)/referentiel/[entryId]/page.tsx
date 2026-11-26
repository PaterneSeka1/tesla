import type { Metadata } from 'next';
import { ReferenceReader } from './reference-reader';

export const metadata: Metadata = { title: 'Référentiel scout' };

export default function ReferenceEntryPage() {
  return <ReferenceReader />;
}
