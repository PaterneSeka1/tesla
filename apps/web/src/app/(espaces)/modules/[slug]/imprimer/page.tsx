import type { Metadata } from 'next';
import { PrintableModule } from './printable-module';

export const metadata: Metadata = { title: 'Version imprimable' };

export default function PrintableModulePage() {
  return <PrintableModule />;
}
