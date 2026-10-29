import { PageHeading } from '@/components/page-heading';
import { AgeRulesView } from '@/components/pathway/age-rules-view';

export default function Page() {
  return (
    <>
      <PageHeading
        title="Référentiel d’âge"
        description="Périodes d’étape selon l’âge, sortie de la branche et délais : seules les règles confirmées y figurent, avec leur source."
      />
      <AgeRulesView />
    </>
  );
}
