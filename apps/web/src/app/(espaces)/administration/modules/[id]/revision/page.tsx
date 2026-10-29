import type { Metadata } from 'next';
import { ModuleRevision } from './module-revision';

export const metadata: Metadata = { title: 'Révision d’un module' };

export default function ModuleRevisionPage() {
  return <ModuleRevision />;
}
