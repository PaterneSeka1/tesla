'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Observation,
  OBSERVATION_VISIBILITIES,
  OBSERVATION_VISIBILITY_LABELS,
} from '@tesla/shared';
import { Info, MessageSquareText, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { OFFLINE_SAVED } from '@/components/progression/use-pedagogy-action';
import { useToast } from '@/components/ui/toaster';
import { OfflineQueuedError } from '@/lib/offline/operations';
import { createObservation, observationsQueryOptions, updateObservation } from '@/lib/api/scouts';
import { formatDate, formatDateTime, fullName, todayIsoDate } from '@/lib/format';

/** Mêmes limites que `createObservationInputSchema` (catégorie vide → aucune, normalisée par l'API). */
const formSchema = z.object({
  observedOn: z.iso.date({ error: 'Date invalide.' }),
  content: z
    .string()
    .trim()
    .min(1, { error: 'Le contenu est requis.' })
    .max(5000, { error: '5 000 caractères au maximum.' }),
  category: z.string().trim().max(80, { error: '80 caractères au maximum.' }),
  visibility: z.enum(OBSERVATION_VISIBILITIES),
});

type FormValues = z.infer<typeof formSchema>;

/** Saisie ou modification (avec `observation`) d'une observation. */
function ObservationForm({
  scoutId,
  observation,
  onDone,
}: {
  scoutId: string;
  observation?: Observation;
  onDone: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const formId = observation ? `obs-${observation.id}` : 'obs-new';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      observedOn: observation?.observedOn ?? todayIsoDate(),
      content: observation?.content ?? '',
      category: observation?.category ?? '',
      visibility: observation?.visibility ?? 'ENCADREMENT',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (observation) await updateObservation(scoutId, observation.id, values);
      else await createObservation(scoutId, values);
      await queryClient.invalidateQueries({
        queryKey: ['scouts', 'detail', scoutId, 'observations'],
      });
      toast.success(observation ? 'Observation modifiée' : 'Observation enregistrée');
      if (!observation) reset({ ...values, content: '', category: '' });
      onDone();
    } catch (error) {
      if (error instanceof OfflineQueuedError) {
        toast.success(OFFLINE_SAVED.title, OFFLINE_SAVED.detail);
        reset({ ...values, content: '', category: '' });
        onDone();
        return;
      }
      toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id={`${formId}-date`}
          label="Date de l’observation"
          required
          error={errors.observedOn?.message}
        >
          <Input
            type="date"
            {...fieldA11y(`${formId}-date`, errors.observedOn?.message)}
            {...register('observedOn')}
          />
        </FormField>
        <FormField
          id={`${formId}-category`}
          label="Catégorie"
          hint="Facultative (libellé libre)."
          error={errors.category?.message}
        >
          <Input
            maxLength={80}
            {...fieldA11y(`${formId}-category`, errors.category?.message, 'hint')}
            {...register('category')}
          />
        </FormField>
        <FormField id={`${formId}-visibility`} label="Visible par">
          <NativeSelect id={`${formId}-visibility`} {...register('visibility')}>
            {OBSERVATION_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {OBSERVATION_VISIBILITY_LABELS[visibility]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        id={`${formId}-content`}
        label="Observation"
        required
        error={errors.content?.message}
      >
        <Textarea
          maxLength={5000}
          {...fieldA11y(`${formId}-content`, errors.content?.message)}
          {...register('content')}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : observation ? 'Enregistrer' : 'Ajouter l’observation'}
        </Button>
        {observation && (
          <Button type="button" variant="outline" onClick={onDone}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

export function ObservationsSection({ scoutId }: { scoutId: string }) {
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data, error, isPending, refetch } = useQuery({
    ...observationsQueryOptions(scoutId, page),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observations de l’encadrement</CardTitle>
        <CardDescription>
          Jamais visibles du routier. Modifiables par leur auteur ; chaque version est conservée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="info">
          <Info aria-hidden />
          <AlertDescription>
            Une observation est une information d’accompagnement : elle ne vaut ni validation d’un
            acquis ni changement d’étape, réservés au responsable plein.
          </AlertDescription>
        </Alert>
        <ObservationForm scoutId={scoutId} onDone={() => setPage(1)} />

        {isPending ? (
          <TableSkeleton rows={3} />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="Aucune observation" />
        ) : (
          <>
            <ul className="space-y-3">
              {data.items.map((observation) => (
                <li key={observation.id} className="rounded-md border p-4">
                  {editingId === observation.id ? (
                    <ObservationForm
                      scoutId={scoutId}
                      observation={observation}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <article className="space-y-2">
                      <header className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{formatDate(observation.observedOn)}</span>
                          {observation.category && (
                            <Badge variant="secondary">{observation.category}</Badge>
                          )}
                          {observation.visibility === 'RESPONSABLE' && (
                            <Badge variant="outline">
                              {OBSERVATION_VISIBILITY_LABELS.RESPONSABLE}
                            </Badge>
                          )}
                        </div>
                        {observation.canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(observation.id)}
                          >
                            <Pencil aria-hidden />
                            Modifier
                          </Button>
                        )}
                      </header>
                      <p className="text-sm whitespace-pre-line">{observation.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {fullName(observation.author)} · saisie le{' '}
                        {formatDateTime(observation.createdAt)}
                        {observation.editedAt &&
                          ` · modifiée le ${formatDateTime(observation.editedAt)}`}
                      </p>
                    </article>
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
      </CardContent>
    </Card>
  );
}
