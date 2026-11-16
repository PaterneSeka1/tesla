import type { Metadata } from 'next';
import { EditAdult } from './edit-adult';

export const metadata: Metadata = { title: 'Modifier un adulte' };

export default function EditAdultPage() {
  return <EditAdult />;
}
