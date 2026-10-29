import { PageHeading } from '@/components/page-heading';
import { RoutierPedagogyDashboard } from '@/components/progression/pedagogy-dashboard';
export default function Page() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Votre parcours dans la Communauté Nikola Tesla."
      />
      <RoutierPedagogyDashboard />
    </>
  );
}
