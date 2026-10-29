import { PageHeading } from '@/components/page-heading';
import { MyCatchUps } from '@/components/pathway/my-pathway';

export default function Page() {
  return (
    <>
      <PageHeading
        title="Mes rattrapages"
        description="Modules obligatoires d’étapes antérieures restant à acquérir. Leur étude, leurs évaluations et l’accompagnement de l’encadrement mènent à une décision du responsable."
      />
      <MyCatchUps />
    </>
  );
}
