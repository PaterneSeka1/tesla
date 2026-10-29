import type { Metadata } from 'next';
import { ModuleDetail } from './module-detail';

export const metadata: Metadata = { title: 'Module' };

export default function ModulePage() {
  return <ModuleDetail />;
}
