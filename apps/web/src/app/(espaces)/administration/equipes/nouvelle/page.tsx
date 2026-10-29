import type { Metadata } from 'next';
import { NewTeam } from './new-team';

export const metadata: Metadata = { title: 'Nouvelle équipe' };

export default function NewTeamPage() {
  return <NewTeam />;
}
