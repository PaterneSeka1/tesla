'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type EvidenceInput } from '@tesla/shared';
import { Send } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { FormField, fieldA11y } from '@/components/form-field';
import { PageHeading } from '@/components/page-heading';
import { EvidencePicker } from '@/components/progression/evidence-picker';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { competenciesQueryOptions, createProposal } from '@/lib/api/progression';
import { scoutsQueryOptions } from '@/lib/api/scouts';
import { fullName } from '@/lib/format';

/** Proposition de validation d'une compétence par un chef (ou le responsable), preuves à l'appui. */
export function NewProposal() {
  const router = useRouter();
  const run = usePedagogyAction();
  const searchParams = useSearchParams();
  const [scoutId, setScoutId] = useState(searchParams.get('scoutId') ?? '');
  const [competencyId, setCompetencyId] = useState('');
  const [justification, setJustification] = useState('');
  const [evidences, setEvidences] = useState<EvidenceInput[]>([]);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const scouts = useQuery({
    ...scoutsQueryOptions({ search: deferredSearch, status: 'active', pageSize: 50 }),
    placeholderData: keepPreviousData,
  });
  const competencies = useQuery(competenciesQueryOptions({ status: 'active', pageSize: 100 }));
  const competency = competencies.data?.items.find((item) => item.id === competencyId);
  const selectedScout = scouts.data?.items.find((item) => item.id === scoutId);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!scoutId) next.scout = 'Choisissez un routier.';
    if (!competencyId) next.competency = 'Choisissez une compétence.';
    if (justification.trim().length < 3)
      next.justification = 'Justification obligatoire (3 caractères au minimum).';
    if (competency && evidences.length < competency.minEvidenceCount) {
      next.evidences = `Cette compétence exige au moins ${competency.minEvidenceCount} élément(s) justificatif(s).`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    const created = { id: '' };
    await run(
      async () => {
        created.id = (
          await createProposal({ scoutProfileId: scoutId, competencyId, justification, evidences })
        ).id;
      },
      { success: 'Proposition soumise au responsable', error: 'Proposition non soumise' },
    );
    setSubmitting(false);
    if (created.id) router.push(`/administration/validations/${created.id}`);
  };

  return (
    <>
      <BackLink href="/administration/validations">Validations</BackLink>
      <PageHeading
        title="Proposer une validation"
        description="Appuyez-vous sur des éléments observables. La proposition n’a aucun effet tant que le responsable n’a pas décidé."
      />
      <Card>
        <CardHeader>
          <CardTitle>Routier et compétence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="proposal-search">Filtrer les routiers</Label>
              <Input
                id="proposal-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <FormField id="proposal-scout" label="Routier" required error={errors.scout}>
                <NativeSelect
                  {...fieldA11y('proposal-scout', errors.scout)}
                  value={scoutId}
                  onChange={(event) => {
                    setScoutId(event.target.value);
                    setEvidences([]);
                  }}
                >
                  <option value="">Choisir…</option>
                  {selectedScout === undefined && scoutId && (
                    <option value={scoutId}>Routier sélectionné</option>
                  )}
                  {scouts.data?.items.map((scout) => (
                    <option key={scout.id} value={scout.id}>
                      {fullName(scout)} — {scout.stage?.name ?? 'sans étape'}
                      {scout.hasAccount ? '' : ' (sans compte)'}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField
              id="proposal-competency"
              label="Compétence"
              required
              error={errors.competency}
              hint={
                competency
                  ? `Éléments exigés : ${competency.minEvidenceCount} au minimum.`
                  : undefined
              }
            >
              <NativeSelect
                {...fieldA11y(
                  'proposal-competency',
                  errors.competency,
                  competency ? 'hint' : undefined,
                )}
                value={competencyId}
                onChange={(event) => setCompetencyId(event.target.value)}
              >
                <option value="">Choisir…</option>
                {competencies.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                    {item.stage ? ` (${item.stage.name})` : ''}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {competency && competency.observableCriteria.length > 0 && (
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">Critères observables</p>
              <ul className="ml-5 list-disc">
                {competency.observableCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
          <FormField
            id="proposal-justification"
            label="Justification"
            required
            error={errors.justification}
          >
            <Textarea
              {...fieldA11y('proposal-justification', errors.justification)}
              rows={4}
              maxLength={3000}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Éléments justificatifs</CardTitle>
          <CardDescription>
            Données déjà enregistrées pour ce routier, ou fait observable décrit librement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {scoutId ? (
            <EvidencePicker scoutId={scoutId} value={evidences} onChange={setEvidences} />
          ) : (
            <p className="text-sm text-muted-foreground">Choisissez d’abord un routier.</p>
          )}
          {errors.evidences && <p className="text-sm text-destructive">{errors.evidences}</p>}
        </CardContent>
      </Card>
      <Button onClick={() => void submit()} disabled={submitting}>
        <Send aria-hidden />
        {submitting ? 'Envoi…' : 'Soumettre au responsable'}
      </Button>
    </>
  );
}
