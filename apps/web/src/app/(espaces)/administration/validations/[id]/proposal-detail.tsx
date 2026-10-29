'use client';

import { useQuery } from '@tanstack/react-query';
import { EVIDENCE_KIND_LABELS, type EvidenceInput, PROPOSAL_ACTION_LABELS } from '@tesla/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { EvidencePicker } from '@/components/progression/evidence-picker';
import { ProposalStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  addEvidence,
  decideProposal,
  proposalAuthorAction,
  proposalQueryOptions,
} from '@/lib/api/progression';
import { formatDateTime, fullName } from '@/lib/format';

/** Proposition : justificatifs, historique ; décision (responsable) ou complément (auteur). */
export function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const run = usePedagogyAction();
  const [extra, setExtra] = useState<EvidenceInput[]>([]);
  const { data: proposal, error, isPending, refetch } = useQuery(proposalQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const revision = proposal.revision;
  const decide =
    (action: 'approve' | 'reject' | 'request-complement', success: string) => (comment: string) =>
      run(() => decideProposal(proposal.id, action, { revision, comment }), {
        success,
        error: 'Décision non enregistrée',
      });

  return (
    <>
      <BackLink href="/administration/validations">Validations</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {proposal.competency.code} {proposal.competency.name}
          </h1>
          <p className="text-muted-foreground">
            <Link
              href={`/administration/routiers/${proposal.scout.id}`}
              className="text-tesla-rouge underline-offset-4 hover:underline"
            >
              {fullName(proposal.scout)}
            </Link>{' '}
            · {proposal.scout.matricule ?? 'matricule non renseigné'} ·{' '}
            {proposal.scout.team?.name ?? 'sans équipe'} ·{' '}
            {proposal.scout.stage?.name ?? 'étape non renseignée'}
          </p>
          <ProposalStatusBadge status={proposal.status} />
        </div>
        {proposal.canDecide && (
          <div className="flex flex-wrap gap-2">
            <CommentDialog
              trigger={<Button>Valider l’acquis</Button>}
              title="Valider officiellement cette compétence ?"
              description={
                <p>Décision officielle, journalisée, révocable uniquement avec motif.</p>
              }
              label="Justification de la décision"
              required
              confirmLabel="Valider"
              onConfirm={decide('approve', 'Acquis validé')}
            />
            <CommentDialog
              trigger={<Button variant="outline">Demander un complément</Button>}
              title="Demander un complément ?"
              description={<p>La proposition est renvoyée à son auteur avec votre demande.</p>}
              label="Complément attendu"
              required
              confirmLabel="Envoyer la demande"
              onConfirm={decide('request-complement', 'Complément demandé')}
            />
            <CommentDialog
              trigger={<Button variant="destructive">Refuser</Button>}
              title="Refuser cette proposition ?"
              description={<p>La compétence sera marquée « à retravailler » pour ce routier.</p>}
              label="Motif du refus"
              required
              destructive
              confirmLabel="Refuser"
              onConfirm={decide('reject', 'Proposition refusée')}
            />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proposition</CardTitle>
          <CardDescription>
            Proposée par {fullName(proposal.proposedBy)} le {formatDateTime(proposal.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-line">{proposal.justification}</p>
          {proposal.competency.observableCriteria.length > 0 && (
            <div className="rounded-md bg-muted/40 p-3">
              <p className="font-medium">Critères observables du référentiel</p>
              <ul className="ml-5 list-disc">
                {proposal.competency.observableCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
          {proposal.decisionComment && (
            <p>
              <strong>Réponse du responsable</strong>
              {proposal.decidedBy && ` (${fullName(proposal.decidedBy)})`} : «{' '}
              {proposal.decisionComment} »
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Éléments justificatifs ({proposal.evidences.length})</CardTitle>
          <CardDescription>
            Minimum fixé par le référentiel : {proposal.competency.minEvidenceCount}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {proposal.evidences.map((evidence) => (
              <li key={evidence.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{EVIDENCE_KIND_LABELS[evidence.kind]}</Badge>
                  {evidence.reference?.startsWith('/') ? (
                    <Link
                      href={evidence.reference}
                      className="text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {evidence.label}
                    </Link>
                  ) : (
                    <span>{evidence.label}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajouté par {fullName(evidence.addedBy)} le {formatDateTime(evidence.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {proposal.canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Compléter la proposition</CardTitle>
            <CardDescription>
              {proposal.status === 'COMPLEMENT_DEMANDE'
                ? 'Ajoutez les éléments demandés, puis soumettez à nouveau.'
                : 'Ajoutez des éléments ou retirez la proposition.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EvidencePicker scoutId={proposal.scout.id} value={extra} onChange={setExtra} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={extra.length === 0}
                onClick={() =>
                  void run(() => addEvidence(proposal.id, { revision, evidences: extra }), {
                    success: 'Éléments ajoutés',
                    error: 'Ajout impossible',
                  }).then((ok) => ok && setExtra([]))
                }
              >
                Ajouter les éléments sélectionnés
              </Button>
              {proposal.status === 'COMPLEMENT_DEMANDE' && (
                <CommentDialog
                  trigger={<Button>Soumettre à nouveau</Button>}
                  title="Soumettre à nouveau au responsable ?"
                  description={<p>Le responsable examinera la proposition complétée.</p>}
                  label="Commentaire (facultatif)"
                  confirmLabel="Soumettre"
                  onConfirm={(comment) =>
                    run(
                      () => proposalAuthorAction(proposal.id, 'resubmit', { revision, comment }),
                      {
                        success: 'Proposition soumise à nouveau',
                        error: 'Soumission impossible',
                      },
                    )
                  }
                />
              )}
              <CommentDialog
                trigger={<Button variant="ghost">Retirer la proposition</Button>}
                title="Retirer cette proposition ?"
                description={<p>Elle restera visible dans l’historique, marquée « retirée ».</p>}
                label="Commentaire (facultatif)"
                destructive
                confirmLabel="Retirer"
                onConfirm={(comment) =>
                  run(() => proposalAuthorAction(proposal.id, 'withdraw', { revision, comment }), {
                    success: 'Proposition retirée',
                    error: 'Retrait impossible',
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {proposal.events.map((event) => (
              <li key={event.id} className="rounded-md border p-3">
                <p className="font-medium">{PROPOSAL_ACTION_LABELS[event.action]}</p>
                {event.comment && <p>« {event.comment} »</p>}
                <p className="text-xs text-muted-foreground">
                  {fullName(event.actor)} · {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
