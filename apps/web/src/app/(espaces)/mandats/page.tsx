import { LeadershipBoard } from '@/components/leadership/leadership-board';
import { PageHeading } from '@/components/page-heading';

export default function Page() {
  return (
    <>
      <PageHeading
        title="Responsables et mandats"
        description="Responsable plein, adjoint et assistants : mandats annuels historisés, reconductions explicites et délégations."
      />
      <LeadershipBoard />
    </>
  );
}
