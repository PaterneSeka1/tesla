'use client';

import { NativeSelect } from '@/components/ui/native-select';
import { userCan } from '@/lib/navigation';

import { Textarea } from '@/components/ui/textarea';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { IMPORT_ROW_ACTION_LABELS, type ProgrammeImportReport } from '@tesla/shared';
import { useSessionUser } from '@/components/auth/session-gate';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import {
  importProgramme,
  programmeCategoriesQueryOptions,
  programmesQueryOptions,
  updateProgrammeCategory,
} from '@/lib/api/programmes';
import { stagesQueryOptions } from '@/lib/api/scouts';

export function AnnualProgramme() {
  const user = useSessionUser();
  const programmes = useQuery(programmesQueryOptions);
  const categories = useQuery(programmeCategoriesQueryOptions);
  const stages = useQuery(stagesQueryOptions);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [report, setReport] = useState<ProgrammeImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  const programmeId = selected || programmes.data?.items[0]?.id || '';
  return (
    <>
      <PageHeading
        title="Programme annuel"
        description="Import vérifiable depuis le document approuvé. Aucune séance n’est générée automatiquement."
      />
      {programmes.isPending && <p role="status">Chargement…</p>}
      {programmes.isError && <p role="alert">Programme indisponible.</p>}
      {programmes.data?.items.length === 0 && <p>Aucun programme configuré.</p>}
      <label>
        Programme
        <NativeSelect
          className="block rounded border p-2"
          aria-label="Programme"
          value={programmeId}
          onChange={(e) => {
            setSelected(e.target.value);
            setReport(null);
          }}
        >
          {programmes.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.realisedCount}/{p.activityCount} réalisées
            </option>
          ))}
        </NativeSelect>
      </label>
      <p>
        <Link className="underline" href="/administration/activites">
          Consulter et gérer les séances
        </Link>
      </p>
      {userCan(user, 'programme.configure') && (
        <section className="space-y-3 rounded border p-4">
          <h2 className="text-xl font-semibold">Importer le programme approuvé</h2>
          <p>
            Collez un tableau Markdown avec les colonnes Date et Activité. Colonnes facultatives :
            Catégories, Thème, Objectifs (séparés par ;), Modules (codes), Responsable, Lieu. Dates
            : AAAA-MM-JJ ou JJ/MM/AAAA. Les séances modifiées manuellement sont conservées.
          </p>
          <label>
            Tableau source
            <Textarea
              rows={10}
              maxLength={200000}
              className="block w-full rounded border p-2 font-mono text-sm"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setReport(null);
              }}
            />
          </label>
          <Button
            disabled={busy || !content || !programmeId}
            onClick={async () => {
              setBusy(true);
              setReport(null);
              await action(
                async () => {
                  setReport(await importProgramme(programmeId, content, false));
                },
                { success: 'Prévisualisation disponible', error: 'Analyse impossible' },
              );
              setBusy(false);
            }}
          >
            Prévisualiser sans écrire
          </Button>
          {report && (
            <>
              <p role="status">
                {report.applied
                  ? 'Import enregistré.'
                  : 'Prévisualisation : vérifiez les lignes avant de confirmer.'}
              </p>
              <ul className="space-y-2">
                {report.rows.map((row, index) => (
                  <li key={`${row.line}-${index}`} className="rounded border p-2">
                    Ligne {row.line} · {row.date} · {row.title} ·{' '}
                    {IMPORT_ROW_ACTION_LABELS[row.action]}
                    <p>{row.messages.join(' ')}</p>
                  </li>
                ))}
              </ul>
              <Button
                disabled={
                  busy || report.applied || report.counts.ERREUR > 0 || report.rows.length === 0
                }
                onClick={async () => {
                  setBusy(true);
                  await action(
                    async () => {
                      setReport(await importProgramme(programmeId, content, true));
                    },
                    { success: 'Programme importé', error: 'Import impossible' },
                  );
                  setBusy(false);
                }}
              >
                Confirmer l’import prévisualisé
              </Button>
            </>
          )}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Correspondance catégories et étapes</h2>
        <p>
          Chaque correspondance nécessite une confirmation du responsable ; aucune durée ni
          promotion automatique.
        </p>
        {categories.isError && <p role="alert">Catégories indisponibles.</p>}
        {categories.data?.items.map((category) => (
          <form
            key={`${category.id}-${category.stage?.id}-${category.correspondenceValidated}`}
            className="flex flex-wrap items-end gap-3 rounded border p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setBusy(true);
              await action(
                () =>
                  updateProgrammeCategory(category.id, {
                    stageId: String(data.get('stageId')) || null,
                    correspondenceValidated: data.get('confirmed') === 'on',
                  }),
                { success: 'Correspondance enregistrée', error: 'Modification impossible' },
              );
              setBusy(false);
            }}
          >
            <label>
              {category.label}
              <NativeSelect
                aria-label={category.label}
                name="stageId"
                defaultValue={category.stage?.id ?? ''}
                disabled={!userCan(user, 'programme.configure')}
                className="block rounded border p-2"
              >
                <option value="">Sans correspondance</option>
                {stages.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label>
              <input
                type="checkbox"
                name="confirmed"
                defaultChecked={category.correspondenceValidated}
                disabled={!userCan(user, 'programme.configure')}
              />{' '}
              Correspondance confirmée
            </label>
            {userCan(user, 'programme.configure') && (
              <Button disabled={busy || !stages.data}>Enregistrer</Button>
            )}
          </form>
        ))}
      </section>
    </>
  );
}
