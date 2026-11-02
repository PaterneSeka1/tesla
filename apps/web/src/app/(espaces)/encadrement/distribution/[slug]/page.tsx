import type { Metadata } from 'next';
import { Distribution } from './distribution';

export const metadata: Metadata = { title: 'Préparer une distribution' };

export default function DistributionPage() {
  return <Distribution />;
}
