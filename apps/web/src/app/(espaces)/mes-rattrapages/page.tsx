import { PageHeading } from '@/components/page-heading';
import { MyCatchUps } from '@/components/pathway/my-pathway';

export default function Page() {
  return (
    <>
      <PageHeading
        title="Rattrapages"
        description="Modules obligatoires d’étapes antérieures. Leur acquisition est décidée par le responsable."
      />
      <MyCatchUps />
    </>
  );
}
