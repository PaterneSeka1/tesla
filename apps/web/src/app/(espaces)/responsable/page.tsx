import { BadgeCheck, FileCheck2, History, KeyRound } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import { PlannedFeatures, type PlannedFeature } from '@/components/planned-features';

const FEATURES: PlannedFeature[] = [
  {
    title: 'Publications à approuver',
    description: 'Modules soumis par les chefs, à approuver ou à renvoyer avec un motif.',
    icon: FileCheck2,
    phase: 'Phase 2',
  },
  {
    title: 'Déblocages individuels',
    description: 'Accès exceptionnel d’un routier à une évaluation, avec justification.',
    icon: KeyRound,
    phase: 'Phase 4',
  },
  {
    title: 'Validation des acquis',
    description: 'Validation officielle, exclusivement humaine, des acquis des routiers.',
    icon: BadgeCheck,
    phase: 'Phase 4',
  },
  {
    title: 'Journal d’audit',
    description: 'Traçabilité des actions sensibles (publications, déblocages, validations).',
    icon: History,
    phase: 'Phase 2',
  },
];

export default function ResponsableDashboardPage() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Pilotage pédagogique : approbations, déblocages et validations."
      />
      <PlannedFeatures features={FEATURES} />
    </>
  );
}
