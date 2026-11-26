import type { Metadata } from 'next';
import { ReferenceCatalogView } from './reference-catalog';

export const metadata: Metadata = { title: 'Référentiel scout' };

export default function ReferencePage() {
  return <ReferenceCatalogView />;
}
