import type { Metadata } from 'next';
import { TeamList } from './team-list';

export const metadata: Metadata = { title: 'Équipes' };

export default function TeamsPage() {
  return <TeamList />;
}
