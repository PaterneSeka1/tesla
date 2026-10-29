'use client';

import { NativeSelect } from '@/components/ui/native-select';

import { Input } from '@/components/ui/input';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeading } from '@/components/page-heading';
import { statisticsQueryOptions } from '@/lib/api/dashboards';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { teamsQueryOptions } from '@/lib/api/teams';

export function StatisticsBoard() {
  const [teamId, setTeam] = useState('');
  const [stageId, setStage] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery(
    statisticsQueryOptions({
      teamId: teamId || undefined,
      stageId: stageId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  );
  const teams = useQuery(teamsQueryOptions({ pageSize: 100 }));
  const stages = useQuery(stagesQueryOptions);
  const d = query.data;
  return (
    <>
      <PageHeading title="Statistiques" />
      <div className="flex flex-wrap gap-3">
        <label>
          Équipe actuelle
          <NativeSelect
            className="block rounded border p-2"
            aria-label="Équipe actuelle"
            value={teamId}
            onChange={(e) => setTeam(e.target.value)}
          >
            <option value="">Toutes</option>
            {teams.data?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Étape actuelle
          <NativeSelect
            className="block rounded border p-2"
            aria-label="Étape actuelle"
            value={stageId}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">Toutes</option>
            {stages.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Du
          <Input
            className="block rounded border p-2"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Au
          <Input
            className="block rounded border p-2"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {query.isPending && <p role="status">Chargement…</p>}
      {query.isError && (
        <p role="alert">Indicateurs indisponibles. Vérifiez les dates sélectionnées.</p>
      )}
      {d && (
        <>
          <p>
            {d.scouts.total} routiers · {d.scouts.active} actifs · {d.scouts.withAccount} avec
            compte · {d.scouts.withoutAccount} sans compte
          </p>
          <p>
            {d.competencies.acquired} acquis validés · {d.competencies.pendingProposals}{' '}
            propositions en attente · {d.moduleStudies} études de modules
          </p>
          <p>
            Activités : {d.activities.planned} planifiées · {d.activities.postponed} reportées ·{' '}
            {d.activities.realised} réalisées · {d.activities.cancelled} annulées
          </p>
          <p>
            Présences : {d.attendance.present} présents · {d.attendance.absent} absents ·{' '}
            {d.attendance.excused} excusés · taux sur les saisies :{' '}
            {d.attendance.rate === null
              ? 'Non calculable'
              : `${Math.round(d.attendance.rate * 100)} %`}
          </p>
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Par équipe actuelle (routiers actifs)</h2>
            {d.byTeam.length === 0 && <p>Aucune donnée.</p>}
            {d.byTeam.map((t) => (
              <div className="rounded border p-3" key={t.team?.id ?? 'none'}>
                <h3 className="font-semibold">
                  {t.team?.name ?? 'Sans équipe'} · {t.active} routiers
                </h3>
                <p>
                  {t.acquiredCompetencies} acquis · {t.attendance.present} présences ·{' '}
                  {t.attendance.absent} absences · {t.attendance.excused} excusés
                </p>
                <p>
                  {t.byStage
                    .map((s) => `${s.stage?.name ?? 'Sans étape'} : ${s.count}`)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </section>
          <section>
            <h2 className="text-xl font-semibold">Par étape</h2>
            {d.byStage.map((s) => (
              <p key={s.stage?.id ?? 'none'}>
                {s.stage?.name ?? 'Sans étape'} · {s.active} routiers · {s.acquiredCompetencies}{' '}
                acquis
              </p>
            ))}
          </section>
          <section>
            <h2 className="text-xl font-semibold">Participation par mois</h2>
            {d.attendanceTrend.length === 0 && <p>Aucune présence renseignée.</p>}
            {d.attendanceTrend.map((m) => (
              <p key={m.month}>
                {m.month} · {m.present} présents · {m.absent} absents · {m.excused} excusés
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
