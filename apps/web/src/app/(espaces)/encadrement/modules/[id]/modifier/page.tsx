import type { Metadata } from 'next';
import { ModuleEditor } from './module-editor';

export const metadata: Metadata = { title: 'Modifier un module' };

export default function EditModulePage() {
  return <ModuleEditor />;
}
