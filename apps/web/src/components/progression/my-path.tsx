'use client';

import { NativeSelect } from '@/components/ui/native-select';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { STUDY_MODE_LABELS, ATTENDANCE_STATUS_LABELS } from '@tesla/shared';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { usePedagogyAction } from './use-pedagogy-action';
import {
  myProgressionQueryOptions,
  publishedModulesQueryOptions,
  declareModuleStudy,
} from '@/lib/api/progression';
import { myActivitiesQueryOptions } from '@/lib/api/dashboards';

export function MyPath({ competenciesOnly = false }: { competenciesOnly?: boolean }) {
  const query = useQuery(myProgressionQueryOptions);
  const modules = useQuery(publishedModulesQueryOptions);
  const action = usePedagogyAction();
  const [busy, setBusy] = useState(false);
  if (query.isPending) return <p role="status">Chargement de votre progression…</p>;
  if (!query.data)
    return (
      <p role="alert">
        Progression indisponible. Vérifiez le rattachement de votre compte auprès du responsable.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </p>
    );
  const d = query.data;
  return (
    <>
      <PageHeading
        title={competenciesOnly ? 'Compétences' : 'Progression'}
        description="Un acquis n’est jamais validé automatiquement."
      />
      <p>
        {d.scout.firstName} {d.scout.lastName} · {d.scout.stage?.name ?? 'Étape non renseignée'} ·{' '}
        {d.scout.team?.name ?? 'Sans équipe'}
      </p>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Compétences officiellement validées</h2>
        {d.acquired.length === 0 && <p>Aucune compétence encore validée.</p>}
        {d.acquired.map((v) => (
          <p key={v.competency.id}>
            {v.competency.code} · {v.competency.name} ·{' '}
            {new Date(v.validatedAt).toLocaleDateString('fr-FR')}
          </p>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Référentiel de mon étape</h2>
        {d.stageCompetencies.length === 0 && <p>Aucune compétence configurée pour votre étape.</p>}
        {d.stageCompetencies.map((c) => (
          <div key={c.competency.id} className="rounded border p-3">
            <h3 className="font-semibold">
              {c.competency.name} · {c.acquired ? 'Validée' : 'À acquérir'}
            </h3>
            <p>{c.competency.description}</p>
            <ul>
              {c.competency.observableCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {!competenciesOnly && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Historique des étapes</h2>
            {d.stageChanges.length === 0 && <p>Aucun changement enregistré.</p>}
            {d.stageChanges.map((s) => (
              <p key={s.id}>
                {s.effectiveOn} · {s.from?.name ?? 'Sans étape'} → {s.to?.name ?? 'Sans étape'}
              </p>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Modules étudiés</h2>
            {d.moduleStudies.length === 0 && <p>Aucune étude enregistrée.</p>}
            {d.moduleStudies.map((s) => (
              <p key={s.id}>
                {s.module.title} · version {s.moduleVersion ?? '—'} · {STUDY_MODE_LABELS[s.mode]} ·{' '}
                {s.studiedOn}
                {s.cancelledAt ? ' · Saisie annulée' : ''}
              </p>
            ))}
            <form
              className="flex flex-wrap items-end gap-3"
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
              <label>
                Déclarer une lecture numérique
                <NativeSelect
                  aria-label="Module publié à déclarer"
                  name="moduleId"
                  required
                  className="block max-w-full rounded border p-2"
                >
                  <option value="">Choisir un module publié</option>
                  {modules.data?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.title}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button disabled={busy || !modules.data}>Déclarer mon étude</Button>
            </form>
          </section>
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
      {query.isPending && <p role="status">Chargement…</p>}
      {query.isError && <p role="alert">Activités indisponibles.</p>}
      {query.data && (
        <>
          <section>
            <h2 className="text-xl font-semibold">À venir</h2>
            {query.data.upcoming.length === 0 && <p>Aucune activité planifiée.</p>}
            {query.data.upcoming.map((a) => (
              <p key={a.id}>
                {a.plannedOn} · {a.title} · {a.leaderLabel}
              </p>
            ))}
          </section>
          <section>
            <h2 className="text-xl font-semibold">Mes participations</h2>
            {query.data.attended.length === 0 && <p>Aucune présence renseignée.</p>}
            {query.data.attended.map(({ activity: a, status }) => (
              <p key={a.id}>
                {a.heldOn ?? a.plannedOn} · {a.title} · {ATTENDANCE_STATUS_LABELS[status]}
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
