import type { Metadata } from 'next';
import { NewModule } from './new-module';

export const metadata: Metadata = { title: 'Nouveau module' };

export default function NewModulePage() {
  return <NewModule />;
}
