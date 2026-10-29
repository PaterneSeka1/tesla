import { PageHeading } from '@/components/page-heading';
import { StaffDashboard } from '@/components/pathway/staff-dashboard';
export default function Page() {
  return (
    <>
      <PageHeading title="Tableau de bord" />
      <StaffDashboard />
    </>
  );
}
