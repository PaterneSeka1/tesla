'use client';

import {
  COMPETENCY_DECISION_LABELS,
  PROPOSAL_STATUS_LABELS,
  type ScoutProgression,
} from '@tesla/shared';
import { BadgeCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { CompetencyStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { revokeValidation } from '@/lib/api/progression';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

/** Compétences du routier : statut déduit des seules décisions humaines enregistrées. */
export function CompetenciesSection({ progression }: { progression: ScoutProgression }) {
  const run = usePedagogyAction();
  const { scout } = progression;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>Compétences</CardTitle>
              <CardDescription>
                « Acquise » uniquement après validation officielle du responsable. Un quiz, une
                présence ou une étude n’y suffisent jamais.
              </CardDescription>
            </div>
            {scout.isActive && (
              <Button asChild size="sm">
                <Link href={`/administration/validations/nouvelle?scoutId=${scout.id}`}>
                  <Plus aria-hidden />
                  Proposer une validation
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {progression.competencies.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="Référentiel vide"
              description="Aucune compétence active."
            />
          ) : (
            <ul className="divide-y text-sm">
              {progression.competencies.map((item) => (
                <li
                  key={item.competency.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.competency.code}
                      </span>{' '}
                      {item.competency.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.competency.stage?.name ?? 'Toutes étapes'}
                      {item.competency.domain && ` · ${item.competency.domain}`}
                      {item.validatedAt && ` · validée le ${formatDate(item.validatedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CompetencyStatusBadge status={item.status} />
                    {item.openProposal && (
                      <Link
                        href={`/administration/validations/${item.openProposal.id}`}
                        className="text-xs text-tesla-rouge underline-offset-4 hover:underline"
                      >
                        Voir la proposition
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Décisions officielles</CardTitle>
          <CardDescription>
            Validations et décisions « à retravailler » du responsable. Une décision n’est jamais
            supprimée : elle peut être révoquée avec motif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {progression.validations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune décision enregistrée.</p>
          ) : (
            progression.validations.map((validation) => (
              <div key={validation.id} className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {validation.competency.code} {validation.competency.name}
                  </span>
                  <Badge variant={validation.decision === 'ACQUIS' ? 'success' : 'destructive'}>
                    {COMPETENCY_DECISION_LABELS[validation.decision]}
                  </Badge>
                  {validation.revokedAt && <Badge variant="outline">Révoquée</Badge>}
                </div>
                <p>« {validation.justification} »</p>
                <p className="text-xs text-muted-foreground">
                  {fullName(validation.decidedBy)}, le {formatDateTime(validation.decidedAt)} ·{' '}
                  <Link
                    href={`/administration/validations/${validation.proposalId}`}
                    className="text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    proposition et justificatifs
                  </Link>
                </p>
                {validation.revokedAt && (
                  <p className="text-xs text-muted-foreground">
                    Révoquée le {formatDateTime(validation.revokedAt)}
                    {validation.revokedBy && ` par ${fullName(validation.revokedBy)}`} : «{' '}
                    {validation.revocationReason} »
                  </p>
                )}
                {progression.canDecide && !validation.revokedAt && (
                  <CommentDialog
                    trigger={
                      <Button size="sm" variant="outline">
                        Révoquer
                      </Button>
                    }
                    title="Révoquer cette décision ?"
                    description={
                      <p>La décision reste visible dans l’historique avec votre motif.</p>
                    }
                    label="Motif"
                    required
                    destructive
                    confirmLabel="Révoquer"
                    onConfirm={(reason) =>
                      run(() => revokeValidation(validation.id, reason), {
                        success: 'Décision révoquée',
                        error: 'Révocation impossible',
                      })
                    }
                  />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {progression.proposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Propositions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {progression.proposals.map((proposal) => (
                <li key={proposal.id}>
                  <Link
                    href={`/administration/validations/${proposal.id}`}
                    className="text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    {proposal.competency.code} {proposal.competency.name}
                  </Link>{' '}
                  — {PROPOSAL_STATUS_LABELS[proposal.status]} · {fullName(proposal.proposedBy)},{' '}
                  {formatDate(proposal.createdAt)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
