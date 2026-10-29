'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type WaiverListQuery } from '@tesla/shared';
import { Unlock } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { RequirePermission } from '@/components/auth/require-permission';
import { EmptyState } from '@/components/empty-state';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { FormField, fieldA11y } from '@/components/form-field';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  availableEvaluationsQueryOptions,
  grantWaiver,
  revokeWaiver,
  waiversQueryOptions,
} from '@/lib/api/evaluations';
import { scoutsQueryOptions } from '@/lib/api/scouts';
import { formatDate, formatDateTime, fullName, todayIsoDate } from '@/lib/format';

const formSchema = z.object({
  scoutProfileId: z.string().min(1, { error: 'Choisissez un routier.' }),
  evaluationId: z.string().min(1, { error: 'Choisissez une évaluation.' }),
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Motif obligatoire (3 caractères au minimum).' })
    .max(1000, { error: '1 000 caractères au maximum.' }),
  expiresOn: z.string(),
});

type FormValues = z.infer<typeof formSchema>;
type StatusFilter = NonNullable<WaiverListQuery['status']>;

/** Déblocages individuels : nominatifs, motivés, datés, révocables et journalisés (responsable). */
export function Waivers() {
  const user = useSessionUser();
  const run = useEvaluationAction();
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [scoutSearch, setScoutSearch] = useState('');
  const deferredScoutSearch = useDeferredValue(scoutSearch.trim());
  const waivers = useQuery({
    ...waiversQueryOptions({ status, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const scouts = useQuery({
    ...scoutsQueryOptions({ search: deferredScoutSearch, status: 'active', pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const evaluations = useQuery(availableEvaluationsQueryOptions({ pageSize: 100 }));
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { scoutProfileId: '', evaluationId: '', reason: '', expiresOn: '' },
  });

  const submit = async (values: FormValues) => {
    const ok = await run(
      () =>
        grantWaiver({
          scoutProfileId: values.scoutProfileId,
          evaluationId: values.evaluationId,
          reason: values.reason,
          ...(values.expiresOn && {
            expiresAt: new Date(`${values.expiresOn}T23:59:59Z`).toISOString(),
          }),
        }),
      { success: 'Déblocage accordé', error: 'Déblocage impossible' },
    );
    if (ok) reset();
  };

  return (
    <RequirePermission user={user} permission="waiver.manage">
      <PageHeading
        title="Déblocages"
        description="Autorise un routier à passer une évaluation hors de son étape. La limite de tentatives reste appliquée."
      />
      <Card>
        <CardHeader>
          <CardTitle>Accorder un déblocage</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(submit)(event)}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="waiver-scout-search">Filtrer les routiers</Label>
                <Input
                  id="waiver-scout-search"
                  type="search"
                  value={scoutSearch}
                  onChange={(event) => setScoutSearch(event.target.value)}
                />
                <FormField
                  id="waiver-scout"
                  label="Routier"
                  required
                  error={errors.scoutProfileId?.message}
                >
                  <NativeSelect
                    {...fieldA11y('waiver-scout', errors.scoutProfileId?.message)}
                    {...register('scoutProfileId')}
                  >
                    <option value="">Choisir…</option>
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
                id="waiver-evaluation"
                label="Évaluation publiée"
                required
                error={errors.evaluationId?.message}
              >
                <NativeSelect
                  {...fieldA11y('waiver-evaluation', errors.evaluationId?.message)}
                  {...register('evaluationId')}
                >
                  <option value="">Choisir…</option>
                  {evaluations.data?.items.map((evaluation) => (
                    <option key={evaluation.id} value={evaluation.id}>
                      {evaluation.code} — {evaluation.title} ({evaluation.stage.name})
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField id="waiver-reason" label="Motif" required error={errors.reason?.message}>
              <Textarea
                {...fieldA11y('waiver-reason', errors.reason?.message)}
                rows={2}
                {...register('reason')}
              />
            </FormField>
            <FormField
              id="waiver-expiry"
              label="Expiration (facultative)"
              hint="Le déblocage cesse à la fin de ce jour."
            >
              <Input
                {...fieldA11y('waiver-expiry', undefined, 'hint')}
                type="date"
                min={todayIsoDate()}
                className="max-w-48"
                {...register('expiresOn')}
              />
            </FormField>
            <Button type="submit" disabled={isSubmitting}>
              <Unlock aria-hidden />
              {isSubmitting ? 'Enregistrement…' : 'Accorder le déblocage'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-semibold">Déblocages enregistrés</h3>
        <div className="space-y-1">
          <Label htmlFor="waiver-status">Afficher</Label>
          <NativeSelect
            id="waiver-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="active">Actifs</option>
            <option value="inactive">Révoqués ou expirés</option>
            <option value="all">Tous</option>
          </NativeSelect>
        </div>
      </div>
      {waivers.isPending ? (
        <TableSkeleton />
      ) : waivers.error ? (
        <QueryError error={waivers.error} onRetry={() => void waivers.refetch()} />
      ) : waivers.data.items.length === 0 ? (
        <EmptyState icon={Unlock} title="Aucun déblocage" />
      ) : (
        <>
          <ul className="space-y-2">
            {waivers.data.items.map((waiver) => (
              <li key={waiver.id} className="space-y-1 rounded-lg border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {fullName(waiver.scout)} · {waiver.evaluation.code} {waiver.evaluation.title}
                  </p>
                  <Badge variant={waiver.active ? 'success' : 'outline'}>
                    {waiver.active ? 'Actif' : waiver.revokedAt ? 'Révoqué' : 'Expiré'}
                  </Badge>
                </div>
                <p>« {waiver.reason} »</p>
                <p className="text-muted-foreground">
                  Accordé par {fullName(waiver.grantedBy)} le {formatDateTime(waiver.grantedAt)}
                  {waiver.expiresAt && ` · expire le ${formatDate(waiver.expiresAt)}`}
                  {` · ${waiver.attemptCount} tentative${waiver.attemptCount > 1 ? 's' : ''}`}
                </p>
                {waiver.revokedAt && (
                  <p className="text-muted-foreground">
                    Révoqué le {formatDateTime(waiver.revokedAt)}
                    {waiver.revokedBy && ` par ${fullName(waiver.revokedBy)}`}
                    {waiver.revocationReason && ` : « ${waiver.revocationReason} »`}
                  </p>
                )}
                {waiver.active && (
                  <CommentDialog
                    trigger={
                      <Button size="sm" variant="outline">
                        Révoquer
                      </Button>
                    }
                    title="Révoquer ce déblocage ?"
                    description={
                      <p>Le routier ne pourra plus démarrer cette évaluation hors de son étape.</p>
                    }
                    label="Motif"
                    required
                    destructive
                    confirmLabel="Révoquer"
                    onConfirm={(reason) =>
                      run(() => revokeWaiver(waiver.id, { reason }), {
                        success: 'Déblocage révoqué',
                        error: 'Révocation impossible',
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={waivers.data.page}
            pageSize={waivers.data.pageSize}
            total={waivers.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </RequirePermission>
  );
}
