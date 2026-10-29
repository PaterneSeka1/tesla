'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { responsableDashboardQueryOptions } from '@/lib/api/dashboards';
import { ProposalList } from './proposal-list';

/** File du responsable : décisions sur les personnes, séparées de l'approbation des contenus. */
function ResponsableQueue() {
  const dashboard = useQuery(responsableDashboardQueryOptions);
  const queue = dashboard.data?.pedagogyQueue;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Propositions de validation à examiner</CardTitle>
          <CardDescription>
            Examinez les éléments justificatifs, puis validez, demandez un complément ou refusez
            avec motif. Les plus anciennes apparaissent en premier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProposalList
            query={{ status: 'EN_ATTENTE' }}
            emptyTitle="Aucune proposition en attente"
            emptyDescription="Les propositions soumises par les chefs apparaîtront ici."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Résultats d’évaluation à examiner</CardTitle>
          <CardDescription>
            Copies corrigées et soumises par les chefs ({queue?.resultsToReview ?? '…'} en attente,{' '}
            {queue?.correctionsInProgress ?? '…'} en cours de correction). Accepter un résultat ne
            valide aucun acquis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/administration/evaluations-a-valider">
              Ouvrir les résultats à examiner
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Compléments demandés</CardTitle>
          <CardDescription>
            Propositions renvoyées à leur auteur, en attente de nouveaux éléments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProposalList
            query={{ status: 'COMPLEMENT_DEMANDE' }}
            emptyTitle="Aucun complément en attente"
            emptyDescription="Les propositions pour lesquelles vous avez demandé un complément apparaîtront ici."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Décisions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ProposalList
            query={{ status: 'closed' }}
            emptyTitle="Aucune décision"
            emptyDescription="Les propositions approuvées, refusées ou retirées apparaîtront ici."
          />
        </CardContent>
      </Card>
    </>
  );
}

export function ValidationsBoard() {
  const user = useSessionUser();
  const isResponsable = userCan(user, 'competency.decide');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          title={isResponsable ? 'Validation des acquis' : 'Mes propositions de validation'}
          description={
            isResponsable
              ? 'Décisions officielles sur les compétences des routiers, exclusivement humaines.'
              : 'Proposez la validation d’une compétence en vous appuyant sur des éléments observables ; seul le responsable décide.'
          }
        />
        <Button asChild>
          <Link href="/administration/validations/nouvelle">
            <Plus aria-hidden />
            Nouvelle proposition
          </Link>
        </Button>
      </div>
      {isResponsable ? (
        <ResponsableQueue />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>En cours</CardTitle>
              <CardDescription>En attente du responsable ou complément demandé.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProposalList
                query={{ status: 'open', mine: 'true' }}
                emptyTitle="Aucune proposition en cours"
                emptyDescription="Vos propositions soumises apparaîtront ici."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Réponses du responsable</CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalList
                query={{ status: 'closed', mine: 'true' }}
                emptyTitle="Aucune réponse"
                emptyDescription="Les décisions du responsable sur vos propositions apparaîtront ici."
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
