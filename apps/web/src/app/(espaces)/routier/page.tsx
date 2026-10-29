import { PageHeading } from '@/components/page-heading';
import { MyPathwayOverview } from '@/components/pathway/my-pathway';
import { RoutierPedagogyDashboard } from '@/components/progression/pedagogy-dashboard';
export default function Page() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Votre parcours dans la Communauté Nikola Tesla."
      />
      <MyPathwayOverview />
      <RoutierPedagogyDashboard />
    </>
  );
}
