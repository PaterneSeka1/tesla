'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { ModuleMetadataForm } from '@/components/modules/module-metadata-form';
import { PageHeading } from '@/components/page-heading';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { createModule } from '@/lib/api/modules';

export function NewModule() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  return (
    <>
      <BackLink href="/encadrement/modules">Mes modules</BackLink>
      <PageHeading
        title="Nouveau module"
        description="Brouillon invisible des routiers jusqu’à sa publication par le responsable."
      />
      <Card>
        <CardContent className="pt-6">
          <ModuleMetadataForm
            submitLabel="Créer le brouillon"
            onSubmit={async (values) => {
              try {
                const created = await createModule(values);
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                toast.success('Brouillon créé', 'Ajoutez maintenant les leçons du module.');
                router.push(`/encadrement/modules/${created.id}/modifier`);
              } catch (error) {
                toast.error(
                  'Création impossible',
                  error instanceof Error ? error.message : undefined,
                );
              }
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
