import type { Metadata } from 'next';
import { EditScout } from './edit-scout';

export const metadata: Metadata = { title: 'Modifier un routier' };

export default function EditScoutPage() {
  return <EditScout />;
}
