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
          <CardTitle>Propositions à examiner</CardTitle>
          <CardDescription>Les plus anciennes en premier.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProposalList
            query={{ status: 'EN_ATTENTE' }}
            emptyTitle="Aucune proposition en attente"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Résultats d’évaluation à examiner</CardTitle>
          <CardDescription>
            {queue?.resultsToReview ?? '…'} en attente · {queue?.correctionsInProgress ?? '…'} en
            correction. Accepter un résultat ne valide aucun acquis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/administration/evaluations-a-valider">Ouvrir</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Compléments demandés</CardTitle>
        </CardHeader>
        <CardContent>
          <ProposalList
            query={{ status: 'COMPLEMENT_DEMANDE' }}
            emptyTitle="Aucun complément en attente"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Décisions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ProposalList query={{ status: 'closed' }} emptyTitle="Aucune décision" />
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
          title={isResponsable ? 'Validation des acquis' : 'Mes propositions'}
          description={isResponsable ? undefined : 'Seul le responsable décide.'}
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
