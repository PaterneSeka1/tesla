'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ELIGIBILITY_LABELS, normalizeAttemptCode } from '@tesla/shared';
import { Printer, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useId, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { EmptyState } from '@/components/empty-state';
import { AttemptTable } from '@/components/evaluations/attempt-table';
import { EligibilityBadge } from '@/components/evaluations/eligibility-badge';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  availableEvaluationsQueryOptions,
  correctionsQueryOptions,
  preparePaperAttempt,
} from '@/lib/api/evaluations';
import { scoutsQueryOptions } from '@/lib/api/scouts';
import { fullName, todayIsoDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Préparation d'une évaluation papier en un seul écran : routier (avec ou sans compte), évaluation
 * publiée, éligibilité vérifiée par le serveur, création de la tentative (code unique), impression.
 */
export function PaperPreparation() {
  const id = useId();
  const router = useRouter();
  const run = useEvaluationAction();
  const [search, setSearch] = useState('');
  const [scoutId, setScoutId] = useState<string | null>(null);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [plannedFor, setPlannedFor] = useState(todayIsoDate());
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const scouts = useQuery({
    ...scoutsQueryOptions({ search: deferredSearch, status: 'active', pageSize: 8 }),
    placeholderData: keepPreviousData,
  });
  const evaluations = useQuery({
    ...availableEvaluationsQueryOptions({ scoutProfileId: scoutId ?? undefined, pageSize: 50 }),
    enabled: scoutId !== null,
  });
  const recent = useQuery(
    correctionsQueryOptions({ mode: 'PAPIER', status: 'PREPAREE', pageSize: 10 }),
  );

  const selectedScout = scouts.data?.items.find((scout) => scout.id === scoutId);
  const selectedEvaluation = evaluations.data?.items.find((item) => item.id === evaluationId);

  const prepare = async () => {
    if (!scoutId || !evaluationId) return;
    setPending(true);
    let created: string | undefined;
    await run(
      async () => {
        const attempt = await preparePaperAttempt({
          scoutProfileId: scoutId,
          evaluationId,
          plannedFor,
        });
        created = attempt.code;
        return attempt;
      },
      { success: 'Tentative papier créée', error: 'Préparation impossible' },
    );
    setPending(false);
    if (created) router.push(`/encadrement/evaluations/papier/${created}`);
  };

  return (
    <>
      <BackLink href="/encadrement/evaluations">Évaluations</BackLink>
      <PageHeading
        title="Évaluation papier"
        description="Pour un routier avec ou sans compte : mêmes règles d’éligibilité qu’en ligne. Le code de tentative est attribué par le serveur."
      />

      <Card>
        <CardHeader>
          <CardTitle>Retrouver une tentative</CardTitle>
          <CardDescription>
            Saisissez le code imprimé sur la feuille (NT-AAAA-NNNNNN).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeAttemptCode(code);
              if (normalized) router.push(`/encadrement/evaluations/papier/${normalized}`);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={`${id}-code`}>Code de tentative</Label>
              <Input
                id={`${id}-code`}
                className="w-56 font-mono uppercase"
                placeholder="NT-2027-000125"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">
              <Search aria-hidden />
              Ouvrir
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Routier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${id}-scout`}>Rechercher par nom, prénoms ou matricule</Label>
            <Input
              id={`${id}-scout`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {scouts.isPending ? (
            <TableSkeleton rows={3} />
          ) : scouts.error ? (
            <QueryError error={scouts.error} onRetry={() => void scouts.refetch()} />
          ) : scouts.data.items.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Aucun routier"
              description="Modifiez la recherche."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Routier">
              {scouts.data.items.map((scout) => (
                <li key={scout.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={scoutId === scout.id}
                    onClick={() => {
                      setScoutId(scout.id);
                      setEvaluationId(null);
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      scoutId === scout.id
                        ? 'border-tesla-rouge bg-tesla-sable/40'
                        : 'hover:border-tesla-or',
                    )}
                  >
                    <span className="font-medium">{fullName(scout)}</span>
                    {!scout.hasAccount && (
                      <Badge variant="outline" className="ml-2">
                        Sans compte
                      </Badge>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {scout.matricule ?? 'Sans matricule'} · {scout.team?.name ?? 'Sans équipe'} ·{' '}
                      {scout.stage?.name ?? 'Étape non renseignée'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {scoutId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Évaluation publiée</CardTitle>
            <CardDescription>
              Éligibilité de {selectedScout ? fullName(selectedScout) : 'ce routier'}, calculée par
              le serveur (étape actuelle ou dérogation active du responsable).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {evaluations.isPending ? (
              <TableSkeleton rows={3} />
            ) : evaluations.error ? (
              <QueryError error={evaluations.error} onRetry={() => void evaluations.refetch()} />
            ) : evaluations.data.items.length === 0 ? (
              <EmptyState
                icon={Printer}
                title="Aucune évaluation publiée"
                description="Une évaluation doit être approuvée et publiée par le responsable avant d’être imprimée."
              />
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Évaluation">
                {evaluations.data.items.map((item) => {
                  const eligibility = item.eligibility!;
                  const disabled = !eligibility.allowed || eligibility.openAttempt !== null;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={evaluationId === item.id}
                        aria-disabled={disabled}
                        disabled={disabled}
                        onClick={() => setEvaluationId(item.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70',
                          evaluationId === item.id
                            ? 'border-tesla-rouge bg-tesla-sable/40'
                            : 'hover:border-tesla-or',
                        )}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{item.title}</span>
                          <EligibilityBadge eligibility={eligibility} />
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.code} · version {item.version} · {item.stage.name} ·{' '}
                          {item.questionCount} questions
                        </span>
                        {eligibility.openAttempt && (
                          <span className="mt-1 block text-xs">
                            Tentative ouverte {eligibility.openAttempt.code} : terminez-la ou
                            annulez-la avant d’en préparer une autre.
                          </span>
                        )}
                        {eligibility.status === 'LIMITE_ATTEINTE' && (
                          <span className="mt-1 block text-xs">
                            {ELIGIBILITY_LABELS.LIMITE_ATTEINTE} ({eligibility.attemptsUsed} /{' '}
                            {eligibility.maxAttempts}).
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {selectedEvaluation && (
        <Card>
          <CardHeader>
            <CardTitle>3. Créer la tentative et imprimer</CardTitle>
            <CardDescription>
              Un code unique sera attribué ; vous pourrez ensuite télécharger le questionnaire A4,
              le corrigé et la grille de correction.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-date`}>Date prévue</Label>
              <Input
                id={`${id}-date`}
                type="date"
                value={plannedFor}
                onChange={(event) => setPlannedFor(event.target.value)}
              />
            </div>
            <Button onClick={() => void prepare()} disabled={pending}>
              <Printer aria-hidden />
              {pending ? 'Création…' : 'Créer la tentative papier'}
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby={`${id}-recent`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-recent`} className="text-lg font-semibold">
            Feuilles préparées, en attente de saisie
          </h3>
          <Button asChild variant="link">
            <Link href="/encadrement/corrections">Toutes les copies</Link>
          </Button>
        </div>
        {recent.isPending ? (
          <TableSkeleton rows={3} />
        ) : recent.error ? (
          <QueryError error={recent.error} onRetry={() => void recent.refetch()} />
        ) : recent.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune feuille en attente.</p>
        ) : (
          <AttemptTable
            items={recent.data.items}
            caption="Feuilles préparées"
            hrefFor={(item) => `/encadrement/evaluations/papier/${item.code}`}
          />
        )}
      </section>
    </>
  );
}
