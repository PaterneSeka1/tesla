'use client';

import { useQuery } from '@tanstack/react-query';
import { ACTIVITY_STATUS_LABELS, type Statistics } from '@tesla/shared';
import {
  BookOpen,
  CalendarCheck,
  CalendarX2,
  ChartColumn,
  ClipboardList,
  Medal,
  Percent,
  UserCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { ChartCard } from '@/components/charts/chart-card';
import { CategoryBarChart, SeriesLineChart } from '@/components/charts/charts';
import { PageHeading } from '@/components/page-heading';
import { QueryError } from '@/components/query-state';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { statisticsQueryOptions } from '@/lib/api/dashboards';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { teamsQueryOptions } from '@/lib/api/teams';
import { formatDateTime, formatMonth } from '@/lib/format';

// Tous les chiffres proviennent de `GET /statistics` (PostgreSQL) : aucune valeur d'exemple, aucun
// classement de routiers, aucune donnée médicale (docs/FEATURES/DASHBOARDS.md).

const EMPTY_FILTERS = { teamId: '', stageId: '', from: '', to: '' };

export function StatisticsBoard() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const query = useQuery(
    statisticsQueryOptions({
      teamId: filters.teamId || undefined,
      stageId: filters.stageId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
  );
  const teams = useQuery(teamsQueryOptions({ pageSize: 100 }));
  const stages = useQuery(stagesQueryOptions);
  const filtered = Object.values(filters).some(Boolean);
  const set = (key: keyof typeof EMPTY_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeading title="Statistiques" />
      <section
        aria-label="Filtres"
        className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4 lg:flex lg:items-end"
      >
        <div className="space-y-1.5 lg:w-48">
          <Label htmlFor="stat-team">Équipe actuelle</Label>
          <NativeSelect
            id="stat-team"
            value={filters.teamId}
            onChange={(e) => set('teamId')(e.target.value)}
          >
            <option value="">Toutes</option>
            {teams.data?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 lg:w-48">
          <Label htmlFor="stat-stage">Étape actuelle</Label>
          <NativeSelect
            id="stat-stage"
            value={filters.stageId}
            onChange={(e) => set('stageId')(e.target.value)}
          >
            <option value="">Toutes</option>
            {stages.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stat-from">Du</Label>
          <Input
            id="stat-from"
            type="date"
            value={filters.from}
            onChange={(e) => set('from')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stat-to">Au</Label>
          <Input
            id="stat-to"
            type="date"
            value={filters.to}
            onChange={(e) => set('to')(e.target.value)}
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            className="col-span-2 sm:col-span-4 lg:col-span-1"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Réinitialiser
          </Button>
        )}
      </section>

      {query.isPending ? (
        <StatisticsSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <StatisticsContent data={query.data} />
      )}
    </>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement des statistiques">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

const stageName = (stage: { name: string } | null) => stage?.name ?? 'Sans étape';

function StatisticsContent({ data: d }: { data: Statistics }) {
  const rate = d.attendance.rate === null ? '—' : `${Math.round(d.attendance.rate * 100)} %`;
  const recorded = d.attendance.present + d.attendance.absent + d.attendance.excused;

  const byStage = d.byStage.map((s) => ({ label: stageName(s.stage), value: s.active }));
  const acquiredByStage = d.byStage.map((s) => ({
    label: stageName(s.stage),
    value: s.acquiredCompetencies,
  }));
  const byTeam = d.byTeam.map((t) => ({ label: t.team?.name ?? 'Sans équipe', value: t.active }));
  const activities = (['PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE'] as const).map((status) => ({
    label: ACTIVITY_STATUS_LABELS[status],
    value: d.activities[STATUS_KEYS[status]],
  }));
  const activityTotal = activities.reduce((sum, item) => sum + item.value, 0);
  const trend = d.attendanceTrend.map((m) => ({ ...m, monthLabel: formatMonth(m.month) }));

  return (
    <div className="space-y-6">
      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Routiers actifs"
          value={d.scouts.active}
          icon={Users}
          hint={`${d.scouts.total} inscrits`}
        />
        <StatCard
          label="Avec compte"
          value={d.scouts.withAccount}
          icon={UserCheck}
          hint={`${d.scouts.withoutAccount} sans compte`}
        />
        <StatCard
          label="Taux d’assiduité"
          value={rate}
          icon={Percent}
          hint={recorded ? `${recorded} présences renseignées` : 'Aucune présence renseignée'}
        />
        <StatCard
          label="Activités réalisées"
          value={d.activities.realised}
          icon={CalendarCheck}
          hint={`${d.activities.planned} planifiées`}
        />
        <StatCard
          label="Acquis validés"
          value={d.competencies.acquired}
          icon={Medal}
          hint={`${d.competencies.toRework} à retravailler`}
        />
        <StatCard
          label="Propositions en attente"
          value={d.competencies.pendingProposals}
          icon={ClipboardList}
          hint={
            d.competencies.complementRequested
              ? `${d.competencies.complementRequested} complément(s) demandé(s)`
              : undefined
          }
        />
        <StatCard label="Modules étudiés" value={d.moduleStudies} icon={BookOpen} />
        <StatCard
          label="Présences à saisir"
          value={d.activities.attendanceMissing}
          icon={CalendarX2}
          hint="Activités passées sans présence"
        />
      </section>

      {(d.scouts.withoutTeam > 0 || d.scouts.withoutStage > 0) && (
        <p className="text-sm text-muted-foreground">
          {d.scouts.withoutTeam} routier(s) sans équipe · {d.scouts.withoutStage} sans étape
          officielle.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Répartition par étape"
          description="Routiers actifs, étape officielle"
          emptyIcon={ChartColumn}
          empty={byStage.every((s) => s.value === 0) ? 'Aucun routier actif.' : undefined}
          columns={[
            { key: 'label', label: 'Étape' },
            { key: 'value', label: 'Routiers actifs' },
          ]}
          rows={byStage}
        >
          <CategoryBarChart data={byStage} valueLabel="Routiers actifs" />
        </ChartCard>

        <ChartCard
          title="Effectifs par équipe"
          description="Routiers actifs, équipe actuelle"
          emptyIcon={ChartColumn}
          empty={byTeam.length === 0 ? 'Aucun routier actif.' : undefined}
          columns={[
            { key: 'label', label: 'Équipe' },
            { key: 'value', label: 'Routiers actifs' },
          ]}
          rows={byTeam}
        >
          <CategoryBarChart data={byTeam} valueLabel="Routiers actifs" />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Présences par mois"
            emptyIcon={CalendarCheck}
            empty={trend.length === 0 ? 'Aucune présence renseignée sur la période.' : undefined}
            columns={[
              { key: 'monthLabel', label: 'Mois' },
              { key: 'present', label: 'Présents' },
              { key: 'excused', label: 'Excusés' },
              { key: 'absent', label: 'Absents' },
            ]}
            rows={trend}
          >
            <SeriesLineChart
              data={trend}
              xKey="month"
              formatX={(month) => formatMonth(month)}
              series={[
                { key: 'present', label: 'Présents' },
                { key: 'excused', label: 'Excusés' },
                { key: 'absent', label: 'Absents' },
              ]}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Activités par statut"
          description={`${d.activities.programme} du programme · ${d.activities.supplementary} supplémentaire(s)`}
          emptyIcon={CalendarCheck}
          empty={activityTotal === 0 ? 'Aucune activité sur la période.' : undefined}
          columns={[
            { key: 'label', label: 'Statut' },
            { key: 'value', label: 'Activités' },
          ]}
          rows={activities}
        >
          <CategoryBarChart data={activities} valueLabel="Activités" />
        </ChartCard>

        <ChartCard
          title="Acquis validés par étape"
          description="Validations officielles du responsable"
          emptyIcon={Medal}
          empty={acquiredByStage.every((s) => s.value === 0) ? 'Aucun acquis validé.' : undefined}
          columns={[
            { key: 'label', label: 'Étape' },
            { key: 'value', label: 'Acquis validés' },
          ]}
          rows={acquiredByStage}
        >
          <CategoryBarChart data={acquiredByStage} valueLabel="Acquis validés" />
        </ChartCard>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-tesla-bordeaux">Détail par équipe</h2>
        {d.byTeam.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Équipe</TableHead>
                <TableHead className="text-right">Routiers</TableHead>
                <TableHead className="text-right">Acquis</TableHead>
                <TableHead className="text-right">Présents</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Excusés</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Absents</TableHead>
                <TableHead className="hidden lg:table-cell">Par étape</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.byTeam.map((t) => (
                <TableRow key={t.team?.id ?? 'none'}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {t.team?.name ?? 'Sans équipe'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.active}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.acquiredCompetencies}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.attendance.present}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {t.attendance.excused}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {t.attendance.absent}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {t.byStage.map((s) => `${stageName(s.stage)} : ${s.count}`).join(' · ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Calculé le {formatDateTime(d.generatedAt)} à partir des données enregistrées.
      </p>
    </div>
  );
}

const STATUS_KEYS = {
  PLANIFIEE: 'planned',
  REALISEE: 'realised',
  REPORTEE: 'postponed',
  ANNULEE: 'cancelled',
} as const;
