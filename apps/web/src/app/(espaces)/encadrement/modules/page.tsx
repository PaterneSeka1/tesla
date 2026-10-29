import type { Metadata } from 'next';
import { EditorModuleList } from '@/components/modules/editor-module-list';

export const metadata: Metadata = { title: 'Mes modules' };

export default function ChefModulesPage() {
  return <EditorModuleList />;
}
