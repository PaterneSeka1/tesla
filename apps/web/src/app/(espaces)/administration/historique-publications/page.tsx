import type { Metadata } from 'next';
import { PublicationHistory } from './publication-history';

export const metadata: Metadata = { title: 'Historique des publications' };

export default function PublicationHistoryPage() {
  return <PublicationHistory />;
}
