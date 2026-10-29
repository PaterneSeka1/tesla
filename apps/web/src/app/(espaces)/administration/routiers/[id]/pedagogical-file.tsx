'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ATTEMPT_STATUS_LABELS,
  EVALUATION_MODE_LABELS,
  type ScoutProgression,
  TIMELINE_KIND_LABELS,
} from '@tesla/shared';
import { CalendarCheck, ClipboardCheck, History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { AttendanceBadge } from '@/components/progression/status-badges';
import { Tabs } from '@/components/progression/tabs';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { scoutProgressionQueryOptions, scoutTimelineQueryOptions } from '@/lib/api/progression';
import { formatDate, formatDateTime, formatScore, fullName } from '@/lib/format';
import { CompetenciesSection } from './competencies-section';
import { ObservationsSection } from './observations-section';
import { StageSection } from './stage-section';
import { StudiesSection } from './studies-section';
import { TeamHistory } from './team-history';

const TABS = [
  { key: 'progression', label: 'Progression' },
  { key: 'competences', label: 'Compétences' },
  { key: 'formations', label: 'Formations' },
  { key: 'evaluations', label: 'Évaluations' },
  { key: 'activites', label: 'Activités' },
  { key: 'observations', label: 'Observations' },
  { key: 'historique', label: 'Historique' },
];

function EvaluationsSection({ progression }: { progression: ScoutProgression }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évaluations</CardTitle>
        <CardDescription>
          Questionnaires en ligne et sur papier. Un résultat est une information : il ne valide ni
          une compétence ni une étape.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {progression.attempts.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucune évaluation"
            description="Les tentatives papier et en ligne apparaîtront ici."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {progression.attempts.map((attempt) => (
              <li key={attempt.id} className="space-y-1 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{attempt.evaluationTitle}</span>
                  <Badge variant="outline">{EVALUATION_MODE_LABELS[attempt.mode]}</Badge>
                  <Badge variant="secondary">{ATTEMPT_STATUS_LABELS[attempt.status]}</Badge>
                  <span className="text-muted-foreground">
                    {formatScore(attempt.score, attempt.maxScore)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={`/encadrement/corrections/${attempt.code}`}
                    className="font-mono text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    {attempt.code}
                  </Link>{' '}
                  ·{' '}
                  {attempt.completedAt
                    ? `réalisée le ${formatDate(attempt.completedAt)}`
                    : `préparée le ${formatDate(attempt.createdAt)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitiesSection({ progression }: { progression: ScoutProgression }) {
  const { attendance } = progression;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Présences et participation</CardTitle>
        <CardDescription>
          {attendance.present} présence(s), {attendance.absent} absence(s), {attendance.excused}{' '}
          absence(s) excusée(s). Indicateur d’accompagnement : il n’entraîne aucune décision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {attendance.recent.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Aucune présence renseignée"
            description="Les présences saisies sur les activités apparaîtront ici."
          />
        ) : (
          <ul className="divide-y text-sm">
            {attendance.recent.map((row) => (
              <li
                key={row.activity.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <Link
                    href={`/administration/activites/${row.activity.id}`}
                    className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    {row.activity.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.activity.heldOn ?? row.activity.plannedOn)}
                    {row.note && ` · ${row.note}`}
                  </p>
                </div>
                <AttendanceBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineSection({ scoutId }: { scoutId: string }) {
  const { data, error, isPending, refetch } = useQuery(scoutTimelineQueryOptions(scoutId));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique complet</CardTitle>
        <CardDescription>
          Équipes, étapes, validations, propositions, études, évaluations et compte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Aucun événement"
            description="Aucune action enregistrée pour ce routier."
          />
        ) : (
          <ol className="space-y-2 text-sm">
            {data.items.map((item, index) => (
              <li key={`${item.at}-${index}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{TIMELINE_KIND_LABELS[item.kind]}</Badge>
                  <span className="font-medium">{item.title}</span>
                </div>
                {item.detail && <p className="mt-1">{item.detail}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(item.at)}
                  {item.by && ` · ${fullName(item.by)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Dossier pédagogique complet du routier, avec ou sans compte. */
export function PedagogicalFile({ scoutId }: { scoutId: string }) {
  const [tab, setTab] = useState('progression');
  const { data, error, isPending, refetch } = useQuery(scoutProgressionQueryOptions(scoutId));

  return (
    <Tabs label="Dossier pédagogique" items={TABS} active={tab} onChange={setTab}>
      {tab === 'observations' ? (
        <ObservationsSection scoutId={scoutId} />
      ) : tab === 'historique' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <TimelineSection scoutId={scoutId} />
          <TeamHistory scoutId={scoutId} />
        </div>
      ) : isPending ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : tab === 'progression' ? (
        <StageSection progression={data} />
      ) : tab === 'competences' ? (
        <CompetenciesSection progression={data} />
      ) : tab === 'formations' ? (
        <StudiesSection progression={data} />
      ) : tab === 'evaluations' ? (
        <EvaluationsSection progression={data} />
      ) : (
        <ActivitiesSection progression={data} />
      )}
    </Tabs>
  );
}
