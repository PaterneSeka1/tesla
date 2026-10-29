import type { Metadata } from 'next';
import { Submissions } from './submissions';

export const metadata: Metadata = { title: 'Soumissions' };

export default function SubmissionsPage() {
  return <Submissions />;
}
