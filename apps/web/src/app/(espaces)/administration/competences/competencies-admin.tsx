'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type Competency, type CompetencyListQuery, COMPETENCY_CODE_PATTERN } from '@tesla/shared';
import { BadgeCheck, Plus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  competenciesQueryOptions,
  createCompetency,
  publishedModulesQueryOptions,
  updateCompetency,
} from '@/lib/api/progression';
import { stagesQueryOptions } from '@/lib/api/scouts';

const formSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => COMPETENCY_CODE_PATTERN.test(value), {
      message: 'Code invalide : lettres, chiffres, - ou _ (ex. SERV-01).',
    }),
  name: z.string().trim().min(3, { error: '3 caractères au minimum.' }).max(150),
  description: z.string().max(3000),
  domain: z.string().max(80),
  stageId: z.string(),
  criteria: z.string().max(6000),
  minEvidenceCount: z.coerce
    .number<string>()
    .int()
    .min(1, { error: '1 au minimum.' })
    .max(10, { error: '10 au maximum.' }),
  position: z.coerce.number<string>().int().min(0).max(10_000),
  moduleIds: z.array(z.string()),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

function CompetencyForm({ competency, onDone }: { competency?: Competency; onDone: () => void }) {
  const run = usePedagogyAction();
  const stages = useQuery(stagesQueryOptions);
  const modules = useQuery(publishedModulesQueryOptions);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: competency?.code ?? '',
      name: competency?.name ?? '',
      description: competency?.description ?? '',
      domain: competency?.domain ?? '',
      stageId: competency?.stage?.id ?? '',
      criteria: competency?.observableCriteria.join('\n') ?? '',
      minEvidenceCount: String(competency?.minEvidenceCount ?? 1),
      position: String(competency?.position ?? 0),
      moduleIds: competency?.modules.map((module) => module.id) ?? [],
    },
  });
  const prefix = competency ? `edit-${competency.id}` : 'new';

  const submit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      description: values.description,
      domain: values.domain,
      stageId: values.stageId || null,
      observableCriteria: values.criteria
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      minEvidenceCount: values.minEvidenceCount,
      position: values.position,
      moduleIds: values.moduleIds,
    };
    const ok = await run(
      () =>
        competency
          ? updateCompetency(competency.id, payload)
          : createCompetency({ code: values.code, ...payload }),
      {
        success: competency ? 'Compétence modifiée' : 'Compétence créée',
        error: 'Enregistrement impossible',
      },
    );
    if (ok) onDone();
  };

  return (
    <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(submit)(event)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id={`${prefix}-code`}
          label="Code"
          required
          error={errors.code?.message}
          hint={competency ? 'Figé après création.' : undefined}
        >
          <Input
            {...fieldA11y(`${prefix}-code`, errors.code?.message)}
            disabled={!!competency}
            {...register('code')}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id={`${prefix}-name`} label="Nom" required error={errors.name?.message}>
            <Input {...fieldA11y(`${prefix}-name`, errors.name?.message)} {...register('name')} />
          </FormField>
        </div>
      </div>
      <FormField
        id={`${prefix}-description`}
        label="Description"
        error={errors.description?.message}
      >
        <Textarea
          {...fieldA11y(`${prefix}-description`, errors.description?.message)}
          rows={2}
          {...register('description')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField
          id={`${prefix}-domain`}
          label="Domaine"
          hint="Libellé libre."
          error={errors.domain?.message}
        >
          <Input
            {...fieldA11y(`${prefix}-domain`, errors.domain?.message, 'hint')}
            {...register('domain')}
          />
        </FormField>
        <FormField id={`${prefix}-stage`} label="Étape concernée">
          <NativeSelect id={`${prefix}-stage`} {...register('stageId')}>
            <option value="">Toutes étapes</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id={`${prefix}-min`}
          label="Preuves minimales"
          error={errors.minEvidenceCount?.message}
        >
          <Input
            {...fieldA11y(`${prefix}-min`, errors.minEvidenceCount?.message)}
            type="number"
            min={1}
            max={10}
            {...register('minEvidenceCount')}
          />
        </FormField>
        <FormField
          id={`${prefix}-position`}
          label="Ordre d’affichage"
          error={errors.position?.message}
        >
          <Input
            {...fieldA11y(`${prefix}-position`, errors.position?.message)}
            type="number"
            min={0}
            {...register('position')}
          />
        </FormField>
      </div>
      <FormField
        id={`${prefix}-criteria`}
        label="Critères observables"
        hint="Un critère par ligne."
        error={errors.criteria?.message}
      >
        <Textarea
          {...fieldA11y(`${prefix}-criteria`, errors.criteria?.message, 'hint')}
          rows={3}
          {...register('criteria')}
        />
      </FormField>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Modules associés</legend>
        {modules.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun module publié.</p>
        )}
        <div className="grid gap-1 sm:grid-cols-2">
          {modules.data?.items.map((module) => (
            <label key={module.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                value={module.id}
                {...register('moduleIds')}
              />
              <span>
                {module.code} — {module.title}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Référentiel administrable : aucune compétence n'est pré-remplie au nom du manuel. */
export function CompetenciesAdmin() {
  const user = useSessionUser();
  const run = usePedagogyAction();
  const isResponsable = userCan(user, 'competency.manage');
  const [status, setStatus] = useState<NonNullable<CompetencyListQuery['status']>>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...competenciesQueryOptions({ status, search: deferredSearch, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading title="Compétences" />
        {isResponsable && editing !== 'new' && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Nouvelle compétence
          </Button>
        )}
      </div>
      {editing === 'new' && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle compétence</CardTitle>
            <CardDescription>
              Domaines proposés à titre d’exemple ; aucune liste officielle n’est imposée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompetencyForm onDone={() => setEditing(null)} />
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="competency-search">Rechercher</Label>
          <Input
            id="competency-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="competency-status">Afficher</Label>
          <NativeSelect
            id="competency-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="active">Actives</option>
            <option value="inactive">Désactivées</option>
            <option value="all">Toutes</option>
          </NativeSelect>
        </div>
      </div>
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Aucune compétence"
          description={isResponsable ? 'Créez la première compétence du référentiel.' : undefined}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((competency) => (
              <li key={competency.id} className="space-y-2 rounded-lg border bg-card p-4 text-sm">
                {editing === competency.id ? (
                  <CompetencyForm competency={competency} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">
                        <span className="font-mono text-muted-foreground">{competency.code}</span>{' '}
                        {competency.name}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{competency.stage?.name ?? 'Toutes étapes'}</Badge>
                        {competency.domain && (
                          <Badge variant="secondary">{competency.domain}</Badge>
                        )}
                        {!competency.isActive && <Badge variant="outline">Désactivée</Badge>}
                      </div>
                    </div>
                    {competency.description && <p>{competency.description}</p>}
                    {competency.observableCriteria.length > 0 && (
                      <ul className="ml-5 list-disc text-muted-foreground">
                        {competency.observableCriteria.map((criterion) => (
                          <li key={criterion}>{criterion}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {competency.minEvidenceCount} élément(s) justificatif(s) minimum
                      {competency.modules.length > 0 &&
                        ` · modules : ${competency.modules.map((module) => module.code).join(', ')}`}
                    </p>
                    {isResponsable && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(competency.id)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(
                              () =>
                                updateCompetency(competency.id, { isActive: !competency.isActive }),
                              {
                                success: competency.isActive
                                  ? 'Compétence désactivée'
                                  : 'Compétence réactivée',
                                error: 'Modification impossible',
                              },
                            )
                          }
                        >
                          {competency.isActive ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
