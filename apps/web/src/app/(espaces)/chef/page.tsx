import { CalendarDays } from 'lucide-react';
import { FollowUpOverview } from '@/components/follow-up-overview';
import { EditorialOverview } from '@/components/modules/editorial-overview';
import { PageHeading } from '@/components/page-heading';
import { PlannedFeatures, type PlannedFeature } from '@/components/planned-features';

const FEATURES: PlannedFeature[] = [
  {
    title: 'Programme annuel',
    description: 'Séances hebdomadaires 2026–2027 et thèmes par niveau.',
    icon: CalendarDays,
    phase: 'Phase 5',
  },
];

export default function ChefDashboardPage() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Préparation des contenus pédagogiques de la communauté."
      />
      <EditorialOverview />
      <FollowUpOverview />
      <PlannedFeatures features={FEATURES} />
    </>
  );
}
