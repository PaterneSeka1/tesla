'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ATTEMPT_STATUS_LABELS,
  type DistributionCandidate,
  ELIGIBILITY_LABELS,
  EVALUATION_MODE_LABELS,
  PAPER_BATCH_MAX,
  type PaperBatchResult,
} from '@tesla/shared';
import { CircleAlert, FileArchive, FileDown, Printer, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  distributionQueryOptions,
  availableEvaluationsQueryOptions,
  paperBatchUrl,
  preparePaperBatch,
} from '@/lib/api/evaluations';
import { catalogModuleQueryOptions, modulePdfUrl } from '@/lib/api/modules';
import { fullName, todayIsoDate } from '@/lib/format';

type Documents = 'cours' | 'evaluation' | 'les-deux';

const DOCUMENT_CHOICES: { value: Documents; label: string }[] = [
  { value: 'les-deux', label: 'Cours et évaluation' },
  { value: 'cours', label: 'Cours uniquement' },
  { value: 'evaluation', label: 'Évaluation uniquement' },
];

/**
 * Distribution collective d'un module (D163) : un PDF commun pour le cours (jamais une copie par
 * routier), des copies individuelles pour l'évaluation (PDF collectif ou ZIP). Éligibilité et
 * tentatives ouvertes calculées par le serveur ; la préparation est idempotente.
 */
export function Distribution() {
  const id = useId();
  const { slug } = useParams<{ slug: string }>();
  const course = useQuery(catalogModuleQueryOptions(slug));
  const evaluations = useQuery(
    // Évaluations publiées (lecture de tout l'encadrement), quel qu'en soit l'auteur.
    availableEvaluationsQueryOptions({ pageSize: 100 }),
  );
  const [documents, setDocuments] = useState<Documents>('les-deux');
  const [chosen, setChosen] = useState('');

  if (course.isPending || evaluations.isPending) return <TableSkeleton rows={6} />;
  if (course.error)
    return <QueryError error={course.error} onRetry={() => void course.refetch()} />;
  if (evaluations.error) {
    return <QueryError error={evaluations.error} onRetry={() => void evaluations.refetch()} />;
  }
  const choices = evaluations.data.items.filter((item) => item.module?.slug === slug);
  const evaluationId = chosen || choices[0]?.id || '';

  return (
    <>
      <BackLink href={`/modules/${slug}`}>{course.data.title}</BackLink>
      <PageHeading title="Préparer une distribution" />
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Documents à distribuer</legend>
            {DOCUMENT_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-tesla-rouge has-[:checked]:bg-tesla-sable/30"
              >
                <input
                  type="radio"
                  name={`${id}-documents`}
                  value={choice.value}
                  checked={documents === choice.value}
                  onChange={() => setDocuments(choice.value)}
                  className="size-4 accent-tesla-rouge"
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      {documents !== 'evaluation' && (
        <Card>
          <CardHeader>
            <CardTitle>Cours</CardTitle>
            <CardDescription>
              Un seul fichier, identique pour tous : imprimez-le autant de fois que nécessaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={modulePdfUrl(slug)} download>
                <FileDown aria-hidden />
                Télécharger le cours (PDF)
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/modules/${slug}/imprimer`}>
                <Printer aria-hidden />
                Version imprimable
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {documents !== 'cours' &&
        (choices.length === 0 ? (
          <EmptyState icon={CircleAlert} title="Aucune évaluation publiée pour ce module" />
        ) : (
          <>
            {choices.length > 1 && (
              <div className="max-w-md space-y-1">
                <Label htmlFor={`${id}-evaluation`}>Évaluation</Label>
                <NativeSelect
                  id={`${id}-evaluation`}
                  value={evaluationId}
                  onChange={(event) => setChosen(event.target.value)}
                >
                  {choices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} (v{item.version})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <Recipients key={evaluationId} evaluationId={evaluationId} />
          </>
        ))}
    </>
  );
}

type AccountFilter = 'tous' | 'avec' | 'sans';

/** Copie réutilisable telle quelle (réimpression) ou préparable ; sinon conflit à traiter à part. */
function selectable(candidate: DistributionCandidate): boolean {
  const open = candidate.openAttempt;
  if (open) return open.mode === 'PAPIER' && open.status === 'PREPAREE';
  return candidate.allowed;
}

function Recipients({ evaluationId }: { evaluationId: string }) {
  const id = useId();
  const { data, error, isPending, refetch } = useQuery(distributionQueryOptions(evaluationId));
  const [account, setAccount] = useState<AccountFilter>('tous');
  const [team, setTeam] = useState('');
  const [stage, setStage] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [plannedFor, setPlannedFor] = useState(todayIsoDate());
  // `null` : sélection par défaut = tous les routiers sélectionnables affichés.
  const [manual, setManual] = useState<Set<string> | null>(null);
  const prepare = useMutation({ mutationFn: preparePaperBatch });

  const candidates = useMemo(() => data?.candidates ?? [], [data]);
  const teams = useMemo(
    () => [
      ...new Map(
        candidates.flatMap((c) => (c.scout.team ? [[c.scout.team.id, c.scout.team]] : [])),
      ).values(),
    ],
    [candidates],
  );
  const stages = useMemo(
    () => [
      ...new Map(
        candidates.flatMap((c) => (c.scout.stage ? [[c.scout.stage.id, c.scout.stage]] : [])),
      ).values(),
    ],
    [candidates],
  );

  if (isPending) return <TableSkeleton rows={8} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const shown = candidates.filter(
    (c) =>
      (account === 'tous' || c.scout.hasAccount === (account === 'avec')) &&
      (!team || c.scout.team?.id === team) &&
      (!stage || c.scout.stage?.id === stage) &&
      (!eligibleOnly || selectable(c)),
  );
  const shownSelectable = shown.filter(selectable);
  const selected = manual ?? new Set(shownSelectable.map((c) => c.scout.id));
  // Destinataires réels : sélectionnés, affichés et sélectionnables.
  const recipients = shownSelectable.filter((c) => selected.has(c.scout.id));
  const toggle = (scoutId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(scoutId);
    else next.delete(scoutId);
    setManual(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data.evaluation.title} · v{data.evaluation.version}
        </CardTitle>
        <CardDescription>
          Une copie individuelle par routier, avec son code unique. Le corrigé n’est jamais imprimé
          sur les copies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-account`}>Compte</Label>
            <NativeSelect
              id={`${id}-account`}
              value={account}
              onChange={(event) => {
                setAccount(event.target.value as AccountFilter);
                setManual(null);
              }}
            >
              <option value="tous">Tous les routiers</option>
              <option value="avec">Avec compte</option>
              <option value="sans">Sans compte</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-team`}>Équipe</Label>
            <NativeSelect
              id={`${id}-team`}
              value={team}
              onChange={(event) => {
                setTeam(event.target.value);
                setManual(null);
              }}
            >
              <option value="">Toutes</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-stage`}>Étape</Label>
            <NativeSelect
              id={`${id}-stage`}
              value={stage}
              onChange={(event) => {
                setStage(event.target.value);
                setManual(null);
              }}
            >
              <option value="">Toutes</option>
              {stages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-date`}>Date prévue</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={plannedFor}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-tesla-rouge"
            checked={eligibleOnly}
            onChange={(event) => {
              setEligibleOnly(event.target.checked);
              setManual(null);
            }}
          />
          Routiers éligibles seulement
        </label>

        {shown.length === 0 ? (
          <EmptyState icon={Users} title="Aucun routier ne correspond" />
        ) : (
          <fieldset className="space-y-2">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {recipients.length} destinataire{recipients.length > 1 ? 's' : ''} sur{' '}
                {shown.length} affiché{shown.length > 1 ? 's' : ''}
              </span>
              <span className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setManual(new Set(shownSelectable.map((c) => c.scout.id)))}
                >
                  Tout sélectionner
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setManual(new Set())}
                >
                  Aucun
                </Button>
              </span>
            </legend>
            <ul className="divide-y rounded-lg border">
              {shown.map((candidate) => (
                <CandidateRow
                  key={candidate.scout.id}
                  candidate={candidate}
                  checked={selected.has(candidate.scout.id)}
                  onChange={(checked) => toggle(candidate.scout.id, checked)}
                />
              ))}
            </ul>
          </fieldset>
        )}

        {recipients.length > PAPER_BATCH_MAX && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {PAPER_BATCH_MAX} routiers au plus par lot : filtrez par équipe ou par étape.
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="button"
          disabled={
            recipients.length === 0 || recipients.length > PAPER_BATCH_MAX || prepare.isPending
          }
          onClick={() =>
            prepare.mutate(
              {
                evaluationId,
                scoutProfileIds: recipients.map((c) => c.scout.id),
                ...(plannedFor && { plannedFor }),
              },
              { onSuccess: () => void refetch() },
            )
          }
        >
          <Printer aria-hidden />
          {prepare.isPending
            ? 'Préparation…'
            : `Préparer ${recipients.length} copie${recipients.length > 1 ? 's' : ''}`}
        </Button>
        {prepare.isError && (
          <Alert variant="destructive" aria-live="assertive">
            <CircleAlert aria-hidden />
            <AlertTitle>Préparation interrompue</AlertTitle>
            <AlertDescription>
              {prepare.error.message} Relancer la préparation reprend le lot sans doublon.
            </AlertDescription>
          </Alert>
        )}
        {prepare.data && <BatchResult result={prepare.data} candidates={candidates} />}
      </CardContent>
    </Card>
  );
}

function CandidateRow({
  candidate,
  checked,
  onChange,
}: {
  candidate: DistributionCandidate;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { scout, openAttempt } = candidate;
  const enabled = selectable(candidate);
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <label className="flex min-h-11 flex-1 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-tesla-rouge"
          checked={enabled && checked}
          disabled={!enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <span className="font-medium">{fullName(scout)}</span>
          <span className="block text-xs text-muted-foreground">
            {[scout.matricule, scout.team?.name, scout.stage?.name].filter(Boolean).join(' · ') ||
              '—'}
          </span>
        </span>
      </label>
      <span className="flex flex-wrap items-center gap-2 text-xs">
        {!scout.hasAccount && <Badge variant="outline">Sans compte</Badge>}
        {openAttempt ? (
          openAttempt.mode === 'PAPIER' && openAttempt.status === 'PREPAREE' ? (
            <Badge variant="secondary">Copie {openAttempt.code} à réimprimer</Badge>
          ) : (
            <Link
              href={`/encadrement/corrections/${openAttempt.code}`}
              className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
            >
              {EVALUATION_MODE_LABELS[openAttempt.mode]} ·{' '}
              {ATTEMPT_STATUS_LABELS[openAttempt.status].toLowerCase()}
              {openAttempt.offlinePending && ' · réservation hors ligne'}
            </Link>
          )
        ) : (
          !candidate.allowed && (
            <span className="text-muted-foreground">
              {ELIGIBILITY_LABELS[candidate.eligibility]}
            </span>
          )
        )}
      </span>
    </li>
  );
}

function BatchResult({
  result,
  candidates,
}: {
  result: PaperBatchResult;
  candidates: DistributionCandidate[];
}) {
  const names = new Map(candidates.map((c) => [c.scout.id, fullName(c.scout)]));
  const codes = result.items.flatMap((item) => (item.code ? [item.code] : []));
  const created = result.items.filter((item) => item.outcome === 'CREEE').length;
  const reused = result.items.filter((item) => item.outcome === 'REUTILISEE').length;
  const skipped = result.items.filter((item) => item.outcome === 'IGNOREE');
  return (
    <div className="space-y-3" aria-live="polite">
      <Alert variant="info">
        <AlertTitle>
          {codes.length} copie{codes.length > 1 ? 's' : ''} prête{codes.length > 1 ? 's' : ''}
        </AlertTitle>
        <AlertDescription>
          {created} nouvelle{created > 1 ? 's' : ''}, {reused} réutilisée
          {reused > 1 ? 's' : ''} (même code, aucune nouvelle tentative)
          {skipped.length > 0 && `, ${skipped.length} non préparée${skipped.length > 1 ? 's' : ''}`}
          .
        </AlertDescription>
      </Alert>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={paperBatchUrl(codes, 'pdf')} download>
              <FileDown aria-hidden />
              PDF collectif
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={paperBatchUrl(codes, 'zip')} download>
              <FileArchive aria-hidden />
              ZIP (un PDF par routier)
            </a>
          </Button>
        </div>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-1 text-sm">
          {skipped.map((item) => (
            <li key={item.scoutProfileId}>
              <span className="font-medium">{names.get(item.scoutProfileId) ?? '—'}</span> :{' '}
              {item.reason?.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
