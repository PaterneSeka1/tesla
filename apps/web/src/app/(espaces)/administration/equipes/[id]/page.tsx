import type { Metadata } from 'next';
import { TeamDetailView } from './team-detail';

export const metadata: Metadata = { title: 'Équipe' };

export default function TeamPage() {
  return <TeamDetailView />;
}
