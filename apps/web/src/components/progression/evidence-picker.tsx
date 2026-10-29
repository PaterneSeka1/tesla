'use client';

import { useQuery } from '@tanstack/react-query';
import { type EvidenceInput, STUDY_MODE_LABELS } from '@tesla/shared';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scoutProgressionQueryOptions } from '@/lib/api/progression';
import { observationsQueryOptions } from '@/lib/api/scouts';
import { formatDate, formatScore } from '@/lib/format';

interface Option {
  key: string;
  label: string;
  evidence: EvidenceInput;
}

/**
 * Choix des éléments justificatifs d'une proposition parmi les données enregistrées du routier
 * (observations, évaluations, présences, études) ou description libre d'un fait observable.
 */
export function EvidencePicker({
  scoutId,
  value,
  onChange,
}: {
  scoutId: string;
  value: EvidenceInput[];
  onChange: (value: EvidenceInput[]) => void;
}) {
  const id = useId();
  const [other, setOther] = useState('');
  const progression = useQuery(scoutProgressionQueryOptions(scoutId));
  const observations = useQuery(observationsQueryOptions(scoutId, 1));

  if (progression.isPending || observations.isPending) return <TableSkeleton rows={3} />;
  if (progression.error)
    return <QueryError error={progression.error} onRetry={() => void progression.refetch()} />;
  if (observations.error)
    return <QueryError error={observations.error} onRetry={() => void observations.refetch()} />;

  const groups: { title: string; options: Option[] }[] = [
    {
      title: 'Observations',
      options: observations.data.items.map((item) => ({
        key: `o-${item.id}`,
        label: `${formatDate(item.observedOn)}${item.category ? ` (${item.category})` : ''} — ${item.content.slice(0, 80)}`,
        evidence: { kind: 'OBSERVATION', observationId: item.id },
      })),
    },
    {
      title: 'Évaluations',
      options: progression.data.attempts
        .filter((attempt) => attempt.status !== 'ANNULEE')
        .map((attempt) => ({
          key: `e-${attempt.id}`,
          label: `${attempt.evaluationTitle} (${attempt.code}) ${formatScore(attempt.score, attempt.maxScore)}`,
          evidence: { kind: 'EVALUATION', attemptId: attempt.id },
        })),
    },
    {
      title: 'Activités (présent)',
      options: progression.data.attendance.recent
        .filter((row) => row.status === 'PRESENT')
        .map((row) => ({
          key: `a-${row.activity.id}`,
          label: `${row.activity.title} — ${formatDate(row.activity.heldOn ?? row.activity.plannedOn)}`,
          evidence: { kind: 'ACTIVITE', activityId: row.activity.id },
        })),
    },
    {
      title: 'Études de modules',
      options: progression.data.moduleStudies
        .filter((study) => !study.cancelledAt)
        .map((study) => ({
          key: `m-${study.id}`,
          label: `${study.module.code} ${study.module.title} — ${STUDY_MODE_LABELS[study.mode]}, ${formatDate(study.studiedOn)}`,
          evidence: { kind: 'ETUDE_MODULE', moduleStudyId: study.id },
        })),
    },
  ];

  const keyOf = (evidence: EvidenceInput) =>
    evidence.kind === 'OBSERVATION'
      ? `o-${evidence.observationId}`
      : evidence.kind === 'EVALUATION'
        ? `e-${evidence.attemptId}`
        : evidence.kind === 'ACTIVITE'
          ? `a-${evidence.activityId}`
          : evidence.kind === 'ETUDE_MODULE'
            ? `m-${evidence.moduleStudyId}`
            : `x-${evidence.description}`;
  const selected = new Set(value.map(keyOf));
  const toggle = (option: Option) =>
    onChange(
      selected.has(option.key)
        ? value.filter((evidence) => keyOf(evidence) !== option.key)
        : [...value, option.evidence],
    );
  const freeItems = value.filter((evidence) => evidence.kind === 'AUTRE');

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <fieldset key={group.title} className="space-y-1">
          <legend className="text-sm font-semibold">{group.title}</legend>
          {group.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun élément enregistré.</p>
          ) : (
            group.options.map((option) => (
              <label key={option.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(option.key)}
                  onChange={() => toggle(option)}
                />
                <span>{option.label}</span>
              </label>
            ))
          )}
        </fieldset>
      ))}
      <div className="space-y-2">
        <Label htmlFor={`${id}-other`}>Autre élément observable</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-other`}
            value={other}
            maxLength={1000}
            onChange={(event) => setOther(event.target.value)}
            placeholder="Ex. : a conduit le service de l’équipe lors de la sortie"
          />
          <Button
            type="button"
            variant="outline"
            disabled={other.trim().length < 3}
            onClick={() => {
              onChange([...value, { kind: 'AUTRE', description: other.trim() }]);
              setOther('');
            }}
          >
            <Plus aria-hidden />
            Ajouter
          </Button>
        </div>
        {freeItems.length > 0 && (
          <ul className="space-y-1 text-sm">
            {freeItems.map((evidence) => (
              <li
                key={keyOf(evidence)}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1"
              >
                <span>{evidence.kind === 'AUTRE' && evidence.description}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Retirer cet élément"
                  onClick={() => onChange(value.filter((item) => item !== evidence))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{value.length} élément(s) sélectionné(s).</p>
    </div>
  );
}
