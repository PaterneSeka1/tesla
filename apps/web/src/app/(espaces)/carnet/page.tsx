import type { Metadata } from 'next';
import { Journal } from '@/components/journal/journal';

export const metadata: Metadata = { title: 'Carnet' };

export default function CarnetPage() {
  return <Journal />;
}
