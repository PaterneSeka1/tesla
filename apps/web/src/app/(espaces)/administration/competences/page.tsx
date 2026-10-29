import type { Metadata } from 'next';
import { CompetenciesAdmin } from './competencies-admin';

export const metadata: Metadata = { title: 'Référentiel de compétences' };

export default function Page() {
  return <CompetenciesAdmin />;
}
