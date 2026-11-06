'use client';

import { useQuery } from '@tanstack/react-query';
import { PROGRESSION_STAGES, STUDY_MODE_LABELS } from '@tesla/shared';
import { BookOpen, CalendarCheck, CalendarDays, Medal } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { MyPathwayOverview } from '@/components/pathway/my-pathway';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Stepper } from '@/components/stepper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { myActivitiesQueryOptions } from '@/lib/api/dashboards';
import {
  myProgressionQueryOptions,
  publishedModulesQueryOptions,
  declareModuleStudy,
} from '@/lib/api/progression';
import { formatDate } from '@/lib/format';
import { AttendanceBadge } from './status-badges';
import { usePedagogyAction } from './use-pedagogy-action';

const STAGE_STEPS = PROGRESSION_STAGES.map((stage) => ({ key: stage.code, label: stage.name }));

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function MyPath({ competenciesOnly = false }: { competenciesOnly?: boolean }) {
  const query = useQuery(myProgressionQueryOptions);
  const modules = useQuery(publishedModulesQueryOptions);
  const action = usePedagogyAction();
  const [busy, setBusy] = useState(false);
  const title = competenciesOnly ? 'Compétences' : 'Progression';
  if (query.isPending) return <TableSkeleton rows={5} />;
  if (!query.data) {
    return (
      <>
        <PageHeading title={title} />
        <QueryError
          error={
            new Error(
              'Progression indisponible. Vérifiez le rattachement de votre compte auprès du responsable.',
            )
          }
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }
  const d = query.data;
  const current = STAGE_STEPS.findIndex((step) => step.key === d.scout.stage?.code);
  return (
    <>
      <PageHeading title={title} />

      {/* Étape calculée selon l'âge (D173) : frise, puis synthèse et modules du parcours. */}
      {!competenciesOnly && (
        <>
          <section aria-label="Étapes de la Route" className="rounded-xl border bg-card p-4 sm:p-5">
            <Stepper label="Étapes de la Route" steps={STAGE_STEPS} current={current} />
          </section>
          <MyPathwayOverview />
        </>
      )}

      <SectionCard title="Référentiel de mon étape">
        {d.stageCompetencies.length === 0 ? (
          <EmptyState icon={Medal} title="Aucune compétence configurée pour votre étape." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {d.stageCompetencies.map((c) => (
              <li key={c.competency.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{c.competency.name}</h3>
                  <Badge variant={c.acquired ? 'success' : 'secondary'}>
                    {c.acquired ? 'Validée' : 'À acquérir'}
                  </Badge>
                </div>
                {c.competency.description && (
                  <p className="text-sm text-muted-foreground">{c.competency.description}</p>
                )}
                {c.competency.observableCriteria.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">
                    {c.competency.observableCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Compétences validées">
        {d.acquired.length === 0 ? (
          <EmptyState icon={Medal} title="Aucune compétence encore validée." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {d.acquired.map((v) => (
              <li
                key={v.competency.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-muted-foreground">{v.competency.code}</span> ·{' '}
                  {v.competency.name}
                </span>
                <span className="text-muted-foreground">{formatDate(v.validatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {!competenciesOnly && (
        <>
          <SectionCard title="Modules étudiés">
            {d.moduleStudies.length === 0 ? (
              <EmptyState icon={BookOpen} title="Aucune étude enregistrée." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {d.moduleStudies.map((s) => (
                  <li key={s.id} className="space-y-0.5 px-3 py-2 text-sm">
                    <p className={s.cancelledAt ? 'line-through' : 'font-medium'}>
                      {s.module.title}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDate(s.studiedOn)} · {STUDY_MODE_LABELS[s.mode]} · version{' '}
                      {s.moduleVersion ?? '—'}
                      {s.cancelledAt ? ' · Saisie annulée' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex flex-wrap items-end gap-3 pt-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const id = String(new FormData(event.currentTarget).get('moduleId'));
                setBusy(true);
                await action(() => declareModuleStudy(id), {
                  success: 'Lecture déclarée',
                  error: 'Déclaration impossible',
                });
                setBusy(false);
              }}
            >
              <div className="min-w-60 flex-1 space-y-1.5">
                <Label htmlFor="declare-module">Déclarer une lecture numérique</Label>
                <NativeSelect id="declare-module" name="moduleId" required>
                  <option value="">Choisir un module publié</option>
                  {modules.data?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button disabled={busy || !modules.data}>Déclarer mon étude</Button>
            </form>
          </SectionCard>

          {/* Décisions d'étape antérieures à D173 : affichées seulement s'il en existe. */}
          {d.stageChanges.length > 0 && (
            <SectionCard title="Historique des étapes">
              <ol className="space-y-2 border-l-2 border-tesla-sable pl-4 text-sm">
                {d.stageChanges.map((s) => (
                  <li key={s.id}>
                    <span className="text-muted-foreground">{formatDate(s.effectiveOn)}</span> ·{' '}
                    {s.from?.name ?? 'Sans étape'} → {s.to?.name ?? 'Sans étape'}
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}

export function MyActivities() {
  const query = useQuery(myActivitiesQueryOptions);
  return (
    <>
      <PageHeading title="Activités" />
      {query.isPending ? (
        <TableSkeleton rows={4} />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <SectionCard title="À venir">
            {query.data.upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Aucune activité planifiée." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {query.data.upcoming.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-x-3 px-3 py-2 text-sm">
                    <span className="w-36 shrink-0 text-muted-foreground">
                      {formatDate(a.plannedOn)}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                    {a.leaderLabel && (
                      <span className="text-muted-foreground">{a.leaderLabel}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Mes participations">
            {query.data.attended.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Aucune présence renseignée." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {query.data.attended.map(({ activity: a, status }) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    <span className="w-36 shrink-0 text-muted-foreground">
                      {formatDate(a.heldOn ?? a.plannedOn)}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                    <AttendanceBadge status={status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </>
  );
}
