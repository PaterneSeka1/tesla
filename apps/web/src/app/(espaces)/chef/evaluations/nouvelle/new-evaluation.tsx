'use client';

import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EvaluationSettingsForm } from '@/components/evaluations/evaluation-settings-form';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { PageHeading } from '@/components/page-heading';
import { Card, CardContent } from '@/components/ui/card';
import { createEvaluation } from '@/lib/api/evaluations';

export function NewEvaluation() {
  const router = useRouter();
  const run = useEvaluationAction();
  return (
    <>
      <BackLink href="/chef/evaluations">Évaluations</BackLink>
      <PageHeading
        title="Nouveau questionnaire"
        description="Le questionnaire est créé en brouillon ; vous ajouterez ensuite les questions, les bonnes réponses et les barèmes."
      />
      <Card>
        <CardContent className="pt-6">
          <EvaluationSettingsForm
            submitLabel="Créer le brouillon"
            onSubmit={async (values) => {
              let id: string | undefined;
              await run(
                async () => {
                  const created = await createEvaluation(values);
                  id = created.id;
                  return created;
                },
                { success: 'Questionnaire créé', error: 'Création impossible' },
              );
              if (id) router.push(`/chef/evaluations/${id}/modifier`);
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
