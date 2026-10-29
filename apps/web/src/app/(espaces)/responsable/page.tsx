import { BadgeCheck, History, KeyRound } from 'lucide-react';
import { FollowUpOverview } from '@/components/follow-up-overview';
import { ReviewOverview } from '@/components/modules/review-overview';
import { PageHeading } from '@/components/page-heading';
import { PlannedFeatures, type PlannedFeature } from '@/components/planned-features';

const FEATURES: PlannedFeature[] = [
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
    title: 'Journal d’audit complet',
    description:
      'Consultation de toutes les actions sensibles (déblocages, validations, fiches). Les décisions de publication sont déjà consultables.',
    icon: History,
    phase: 'Phase 4',
  },
];

export default function ResponsableDashboardPage() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Pilotage pédagogique : approbations, déblocages et validations."
      />
      <ReviewOverview />
      <FollowUpOverview />
      <PlannedFeatures features={FEATURES} />
    </>
  );
}
