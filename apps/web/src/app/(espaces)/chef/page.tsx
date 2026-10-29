import { CalendarDays, FilePenLine, Hourglass } from 'lucide-react';
import { FollowUpOverview } from '@/components/follow-up-overview';
import { PageHeading } from '@/components/page-heading';
import { PlannedFeatures, type PlannedFeature } from '@/components/planned-features';

const FEATURES: PlannedFeature[] = [
  {
    title: 'Mes modules en rédaction',
    description: 'Brouillons de modules et de leçons en cours de création ou de modification.',
    icon: FilePenLine,
    phase: 'Phase 2',
  },
  {
    title: 'En attente d’approbation',
    description: 'Modules soumis : seule l’approbation du responsable permet leur publication.',
    icon: Hourglass,
    phase: 'Phase 2',
  },
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
      <FollowUpOverview />
      <PlannedFeatures features={FEATURES} />
    </>
  );
}
