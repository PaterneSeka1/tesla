import type { Metadata } from 'next';
import { ProposalDetail } from './proposal-detail';

export const metadata: Metadata = { title: 'Proposition de validation' };

export default function Page() {
  return <ProposalDetail />;
}
