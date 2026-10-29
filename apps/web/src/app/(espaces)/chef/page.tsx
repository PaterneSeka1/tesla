import { PageHeading } from '@/components/page-heading';
import { ChefPedagogyDashboard } from '@/components/progression/pedagogy-dashboard';
export default function Page() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Suivi pédagogique de la communauté Nikola Tesla."
      />
      <ChefPedagogyDashboard />
    </>
  );
}
