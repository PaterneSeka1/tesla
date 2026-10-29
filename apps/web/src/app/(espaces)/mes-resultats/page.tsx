import type { Metadata } from 'next';
import { MyResults } from './my-results';

export const metadata: Metadata = { title: 'Mes résultats' };

export default function MyResultsPage() {
  return <MyResults />;
}
