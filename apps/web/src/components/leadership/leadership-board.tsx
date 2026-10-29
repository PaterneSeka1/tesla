'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DELEGABLE_PERMISSIONS,
  LEADER_FUNCTION_LABELS,
  LEADER_FUNCTIONS,
  type LeaderFunction,
  LEGACY_ROLE_LABELS,
  type Mandate,
  MANDATE_KIND_LABELS,
  MANDATE_KINDS,
  type MandateKind,
  PERMISSION_LABELS,
  type SessionUser,
  type UserSummary,
} from '@tesla/shared';
import { BadgeCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { formatCivilDate } from '@/components/pathway/pathway-summary';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  createDelegation,
  createScoutYear,
  endMandate,
  leadershipOverviewQueryOptions,
  mandateHistoryQueryOptions,
  reconductionDraftQueryOptions,
  recordMandate,
  revokeDelegation,
} from '@/lib/api/leadership';
import { todayIsoDate } from '@/lib/format';
import { userCan } from '@/lib/navigation';

const name = (user: UserSummary) => `${user.firstName} ${user.lastName}`;

function MandateLine({ mandate, actions }: { mandate: Mandate; actions?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {name(mandate.user)}
          <Badge variant={mandate.function === 'PLEIN' ? 'default' : 'secondary'}>
            {LEADER_FUNCTION_LABELS[mandate.function]}
          </Badge>
          <Badge variant="outline">{MANDATE_KIND_LABELS[mandate.kind]}</Badge>
          {mandate.active && <Badge variant="success">En exercice</Badge>}
        </p>
        <p className="text-sm text-muted-foreground">
          {mandate.scoutYear.label} · du {formatCivilDate(mandate.startsOn)} au{' '}
          {formatCivilDate(mandate.effectiveEndOn)}
          {mandate.endedEarlyOn && ` (fin anticipée : ${mandate.endReason})`} · Nomination :{' '}
          {mandate.appointingAuthority}
          {mandate.appointmentReference && ` (${mandate.appointmentReference})`}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </li>
  );
}

// ─── Enregistrement d'un mandat ─────────────────────────────────────────────

const mandateFormSchema = z.object({
  userId: z.uuid({ error: 'Choisissez la personne.' }),
  function: z.enum(LEADER_FUNCTIONS, { error: 'Choisissez la fonction.' }),
  scoutYearId: z.uuid({ error: 'Choisissez l’année scoute.' }),
  kind: z.enum(MANDATE_KINDS),
  appointingAuthority: z
    .string()
    .trim()
    .min(3, { error: 'L’autorité de nomination est obligatoire (3 caractères au minimum).' })
    .max(300),
  appointmentReference: z.string().trim().max(300),
  previousMandateId: z.string(),
  startsOn: z.string(),
  notes: z.string().trim().max(3000),
});

type MandateFormValues = z.infer<typeof mandateFormSchema>;

function MandateForm({
  user,
  staff,
  years,
  history,
  initial,
  onDone,
}: {
  user: SessionUser;
  staff: UserSummary[];
  years: { id: string; label: string }[];
  history: Mandate[];
  initial?: Partial<MandateFormValues>;
  onDone?: () => void;
}) {
  const run = usePedagogyAction();
  const [pending, setPending] = useState<MandateFormValues | null>(null);
  const allowed = LEADER_FUNCTIONS.filter((fn) =>
    userCan(user, fn === 'PLEIN' ? 'mandate.recordPlein' : 'mandate.recordTeam'),
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MandateFormValues>({
    resolver: zodResolver(mandateFormSchema),
    defaultValues: {
      userId: '',
      function: allowed[0] ?? 'ASSISTANT',
      scoutYearId: years[0]?.id ?? '',
      kind: 'NOMINATION',
      appointingAuthority: '',
      appointmentReference: '',
      previousMandateId: '',
      startsOn: '',
      notes: '',
      ...initial,
    },
  });
  if (allowed.length === 0) return null;
  const person = staff.find((candidate) => candidate.id === pending?.userId);

  const confirm = async () => {
    if (!pending) return;
    const ok = await run(
      () =>
        recordMandate({
          userId: pending.userId,
          function: pending.function,
          scoutYearId: pending.scoutYearId,
          kind: pending.kind,
          appointingAuthority: pending.appointingAuthority,
          appointmentReference: pending.appointmentReference,
          previousMandateId: pending.previousMandateId || null,
          startsOn: pending.startsOn || undefined,
          notes: pending.notes,
          confirm: true,
        }),
      { success: 'Mandat enregistré.', error: 'Mandat non enregistré.' },
    );
    if (ok) {
      setPending(null);
      reset();
      onDone?.();
    }
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => void handleSubmit((values) => setPending(values))(event)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="mandate-user" label="Personne" required error={errors.userId?.message}>
          <NativeSelect
            {...fieldA11y('mandate-user', errors.userId?.message)}
            {...register('userId')}
          >
            <option value="">Choisir…</option>
            {staff.map((candidate) => (
              <option key={candidate.id} value={candidate.id} disabled={candidate.id === user.id}>
                {name(candidate)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="mandate-function" label="Fonction" required error={errors.function?.message}>
          <NativeSelect {...fieldA11y('mandate-function')} {...register('function')}>
            {allowed.map((fn) => (
              <option key={fn} value={fn}>
                {LEADER_FUNCTION_LABELS[fn]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="mandate-year"
          label="Année scoute"
          required
          error={errors.scoutYearId?.message}
        >
          <NativeSelect
            {...fieldA11y('mandate-year', errors.scoutYearId?.message)}
            {...register('scoutYearId')}
          >
            <option value="">Choisir…</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="mandate-kind" label="Nature" required>
          <NativeSelect {...fieldA11y('mandate-kind')} {...register('kind')}>
            {MANDATE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {MANDATE_KIND_LABELS[kind]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="mandate-previous"
          label="Mandat précédent"
          hint="Obligatoire pour une reconduction ou un changement de fonction."
        >
          <NativeSelect
            {...fieldA11y('mandate-previous', undefined, 'hint')}
            {...register('previousMandateId')}
          >
            <option value="">Aucun</option>
            {history.map((mandate) => (
              <option key={mandate.id} value={mandate.id}>
                {name(mandate.user)} · {LEADER_FUNCTION_LABELS[mandate.function]} ·{' '}
                {mandate.scoutYear.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="mandate-start"
          label="Début (si différent de l’année)"
          hint="Laisser vide : début de l’année scoute."
        >
          <Input
            type="date"
            {...fieldA11y('mandate-start', undefined, 'hint')}
            {...register('startsOn')}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="mandate-authority"
          label="Autorité de nomination"
          required
          error={errors.appointingAuthority?.message}
        >
          <Input
            {...fieldA11y('mandate-authority', errors.appointingAuthority?.message)}
            {...register('appointingAuthority')}
          />
        </FormField>
        <FormField id="mandate-reference" label="Référence de l’acte">
          <Input {...fieldA11y('mandate-reference')} {...register('appointmentReference')} />
        </FormField>
      </div>
      <FormField id="mandate-notes" label="Observations">
        <Textarea rows={2} {...fieldA11y('mandate-notes')} {...register('notes')} />
      </FormField>
      <Button type="submit">Vérifier et enregistrer</Button>
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l’enregistrement du mandat</DialogTitle>
            <DialogDescription>
              {person ? name(person) : 'Personne'} ·{' '}
              {pending && LEADER_FUNCTION_LABELS[pending.function]} ·{' '}
              {pending && MANDATE_KIND_LABELS[pending.kind]} · nommé par{' '}
              {pending?.appointingAuthority}. Le mandat sera conservé dans l’historique et ne pourra
              plus être modifié, seulement terminé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={() => void confirm()}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

// ─── Actions sur un mandat ──────────────────────────────────────────────────

function EndMandateButton({ mandate }: { mandate: Mandate }) {
  const run = usePedagogyAction();
  const [endedEarlyOn, setEndedEarlyOn] = useState(todayIsoDate());
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          Fin anticipée
        </Button>
      }
      title={`Fin du mandat de ${name(mandate.user)}`}
      confirmLabel="Enregistrer la fin"
      destructive
      description={
        <>
          <FormField id={`end-${mandate.id}-date`} label="Dernier jour exercé" required>
            <Input
              type="date"
              min={mandate.startsOn}
              max={mandate.endsOn}
              value={endedEarlyOn}
              onChange={(event) => setEndedEarlyOn(event.target.value)}
              {...fieldA11y(`end-${mandate.id}-date`)}
            />
          </FormField>
          <FormField id={`end-${mandate.id}-reason`} label="Motif" required>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              {...fieldA11y(`end-${mandate.id}-reason`)}
            />
          </FormField>
        </>
      }
      onConfirm={() =>
        run(() => endMandate(mandate.id, { endedEarlyOn, reason, confirm: true }), {
          success: 'Fin de mandat enregistrée.',
          error: 'Fin de mandat non enregistrée.',
        })
      }
    />
  );
}

function kindOf(value: string): MandateKind {
  return (MANDATE_KINDS as readonly string[]).includes(value)
    ? (value as MandateKind)
    : 'NOMINATION';
}

// ─── Délégations ────────────────────────────────────────────────────────────

const delegationFormSchema = z
  .object({
    delegateId: z.uuid({ error: 'Choisissez le bénéficiaire.' }),
    permissions: z.array(z.string()).min(1, { error: 'Choisissez au moins une permission.' }),
    startsOn: z.iso.date({ error: 'Date invalide.' }),
    endsOn: z.iso.date({ error: 'Date invalide.' }),
    reason: z
      .string()
      .trim()
      .min(3, { error: 'Le motif est obligatoire (3 caractères au minimum).' }),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    error: 'La fin doit suivre le début.',
    path: ['endsOn'],
  });

type DelegationFormValues = z.infer<typeof delegationFormSchema>;

function DelegationForm({ candidates }: { candidates: UserSummary[] }) {
  const run = usePedagogyAction();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DelegationFormValues>({
    resolver: zodResolver(delegationFormSchema),
    defaultValues: {
      delegateId: '',
      permissions: [],
      startsOn: todayIsoDate(),
      endsOn: todayIsoDate(),
      reason: '',
    },
  });
  const submit = async (values: DelegationFormValues) => {
    const ok = await run(() => createDelegation({ ...values, confirm: true }), {
      success: 'Délégation enregistrée.',
      error: 'Délégation non enregistrée.',
    });
    if (ok) reset();
  };
  return (
    <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(submit)(event)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="delegate"
          label="Bénéficiaire (sous mandat)"
          required
          error={errors.delegateId?.message}
        >
          <NativeSelect
            {...fieldA11y('delegate', errors.delegateId?.message)}
            {...register('delegateId')}
          >
            <option value="">Choisir…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {name(candidate)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="delegation-start" label="Du" required error={errors.startsOn?.message}>
          <Input
            type="date"
            {...fieldA11y('delegation-start', errors.startsOn?.message)}
            {...register('startsOn')}
          />
        </FormField>
        <FormField id="delegation-end" label="Au (inclus)" required error={errors.endsOn?.message}>
          <Input
            type="date"
            {...fieldA11y('delegation-end', errors.endsOn?.message)}
            {...register('endsOn')}
          />
        </FormField>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Permissions déléguées</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {DELEGABLE_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={permission} {...register('permissions')} />
              {PERMISSION_LABELS[permission] ?? permission}
            </label>
          ))}
        </div>
        {errors.permissions && (
          <p className="text-sm text-destructive">{errors.permissions.message}</p>
        )}
      </fieldset>
      <FormField id="delegation-reason" label="Motif" required error={errors.reason?.message}>
        <Textarea
          rows={2}
          {...fieldA11y('delegation-reason', errors.reason?.message)}
          {...register('reason')}
        />
      </FormField>
      <Button type="submit">Déléguer</Button>
    </form>
  );
}

// ─── Années scoutes ─────────────────────────────────────────────────────────

const yearFormSchema = z.object({
  label: z.string().regex(/^\d{4}-\d{4}$/, { error: 'Libellé attendu : AAAA-AAAA.' }),
  startsOn: z.iso.date({ error: 'Date invalide.' }),
  endsOn: z.iso.date({ error: 'Date invalide.' }),
});

function ScoutYearForm() {
  const run = usePedagogyAction();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof yearFormSchema>>({
    resolver: zodResolver(yearFormSchema),
    defaultValues: { label: '', startsOn: '', endsOn: '' },
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-4 sm:items-end"
      noValidate
      onSubmit={(event) =>
        void handleSubmit(async (values) => {
          if (
            await run(() => createScoutYear(values), {
              success: 'Année scoute enregistrée.',
              error: 'Année non enregistrée.',
            })
          )
            reset();
        })(event)
      }
    >
      <FormField id="year-label" label="Libellé" required error={errors.label?.message}>
        <Input
          placeholder="2027-2028"
          {...fieldA11y('year-label', errors.label?.message)}
          {...register('label')}
        />
      </FormField>
      <FormField id="year-start" label="Premier jour" required error={errors.startsOn?.message}>
        <Input
          type="date"
          {...fieldA11y('year-start', errors.startsOn?.message)}
          {...register('startsOn')}
        />
      </FormField>
      <FormField id="year-end" label="Dernier jour" required error={errors.endsOn?.message}>
        <Input
          type="date"
          {...fieldA11y('year-end', errors.endsOn?.message)}
          {...register('endsOn')}
        />
      </FormField>
      <Button type="submit">Ajouter</Button>
    </form>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────

/**
 * Responsables et mandats : encadrement en exercice, vacances, comptes à résoudre, historique par
 * année, nomination, reconduction préremplie (confirmation explicite), fin anticipée, délégations.
 * Chaque action est vérifiée par l'API ; les boutons ne sont qu'un confort d'affichage.
 */
export function LeadershipBoard() {
  const user = useSessionUser();
  const overview = useQuery(leadershipOverviewQueryOptions);
  const [yearFilter, setYearFilter] = useState('');
  const history = useQuery(mandateHistoryQueryOptions(yearFilter || undefined));
  const [draft, setDraft] = useState<Partial<MandateFormValues> | null>(null);
  const run = usePedagogyAction();
  const queryClient = useQueryClient();

  if (overview.isPending) return <TableSkeleton rows={6} />;
  if (overview.error)
    return <QueryError error={overview.error} onRetry={() => void overview.refetch()} />;
  const d = overview.data;
  const staff = [
    ...new Map(
      [...d.current.map((mandate) => mandate.user), ...d.withoutMandate].map((u) => [u.id, u]),
    ).values(),
  ];
  const canRecord = (fn: LeaderFunction) =>
    userCan(user, fn === 'PLEIN' ? 'mandate.recordPlein' : 'mandate.recordTeam');
  const canDelegate = userCan(user, 'delegation.manage');

  const prepareReconduction = async (mandate: Mandate) => {
    await run(
      async () => {
        const result = await queryClient.fetchQuery(reconductionDraftQueryOptions(mandate.id));
        if (!result.draft.scoutYearId) {
          throw new Error('Déclarez d’abord l’année scoute suivante.');
        }
        setDraft({
          userId: result.draft.userId,
          function: result.draft.function,
          scoutYearId: result.draft.scoutYearId,
          kind: kindOf(result.draft.kind),
          previousMandateId: result.draft.previousMandateId,
        });
      },
      {
        success: 'Reconduction préremplie : vérifiez puis confirmez.',
        error: 'Préremplissage impossible.',
      },
    );
  };

  return (
    <div className="space-y-6">
      {d.vacancies.plein && (
        <Alert variant="info">
          <UserX aria-hidden />
          <AlertDescription>
            Aucun responsable plein en exercice : les décisions officielles sont suspendues jusqu’à
            l’enregistrement d’une nomination.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Encadrement en exercice</CardTitle>
          <CardDescription>
            {d.currentScoutYear
              ? `Année scoute ${d.currentScoutYear.label}`
              : 'Aucune année scoute en cours'}{' '}
            · au {formatCivilDate(d.today)}
            {d.vacancies.adjoint && ' · poste d’adjoint vacant'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.current.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="Aucun mandat en vigueur" />
          ) : (
            <ul className="stagger space-y-2">
              {d.current.map((mandate) => (
                <MandateLine
                  key={mandate.id}
                  mandate={mandate}
                  actions={
                    canRecord(mandate.function) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void prepareReconduction(mandate)}
                        >
                          Reconduire pour l’année suivante
                        </Button>
                        <EndMandateButton mandate={mandate} />
                      </>
                    )
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {d.withoutMandate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Encadrement sans mandat</CardTitle>
            <CardDescription>Aucune décision officielle possible sans mandat.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {d.withoutMandate.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-2">
                  {name(member)}
                  {member.legacyRole && (
                    <Badge variant="outline">{LEGACY_ROLE_LABELS[member.legacyRole]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(canRecord('PLEIN') || canRecord('ADJOINT')) && (
        <Card>
          <CardHeader>
            <CardTitle>{draft ? 'Reconduction (préremplie)' : 'Enregistrer un mandat'}</CardTitle>
            <CardDescription>
              Toute nomination, reconduction ou changement crée un nouveau mandat annuel. Personne
              ne consigne sa propre nomination.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {d.scoutYears.length === 0 ? (
              <p className="text-sm text-muted-foreground">Déclarez d’abord une année scoute.</p>
            ) : (
              <MandateForm
                key={JSON.stringify(draft)}
                user={user}
                staff={staff}
                years={d.scoutYears}
                history={history.data?.mandates ?? []}
                initial={draft ?? undefined}
                onDone={() => setDraft(null)}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Délégations</CardTitle>
          <CardDescription>
            Nominatives et révocables ; elles cessent avec le mandat du responsable plein.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {d.delegations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune délégation en cours ou à venir.</p>
          ) : (
            <ul className="space-y-2">
              {d.delegations.map((delegation) => (
                <li
                  key={delegation.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {name(delegation.delegator)} → {name(delegation.delegate)}
                      {delegation.active && <Badge variant="success">Active</Badge>}
                      {delegation.revokedAt && <Badge variant="outline">Révoquée</Badge>}
                    </p>
                    <p className="text-muted-foreground">
                      Du {formatCivilDate(delegation.startsOn)} au{' '}
                      {formatCivilDate(delegation.endsOn)} ·{' '}
                      {delegation.permissions
                        .map(
                          (permission) =>
                            PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] ??
                            permission,
                        )
                        .join(', ')}
                    </p>
                  </div>
                  {canDelegate && !delegation.revokedAt && (
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline">
                          Révoquer
                        </Button>
                      }
                      title="Révoquer la délégation"
                      confirmLabel="Révoquer"
                      destructive
                      description={
                        <p>La délégation cesse immédiatement ; elle reste dans l’historique.</p>
                      }
                      onConfirm={() =>
                        run(
                          () =>
                            revokeDelegation(delegation.id, {
                              reason: 'Révocation par le responsable plein',
                            }),
                          {
                            success: 'Délégation révoquée.',
                            error: 'Révocation impossible.',
                          },
                        )
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {canDelegate && (
            <DelegationForm
              candidates={d.current.filter((m) => m.user.id !== user.id).map((m) => m.user)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des mandats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField id="history-year" label="Année scoute">
            <NativeSelect
              id="history-year"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="">Toutes</option>
              {d.scoutYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {history.isPending && <TableSkeleton rows={3} />}
          {history.error && (
            <QueryError error={history.error} onRetry={() => void history.refetch()} />
          )}
          {history.data &&
            (history.data.mandates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mandat enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {history.data.mandates.map((mandate) => (
                  <MandateLine key={mandate.id} mandate={mandate} />
                ))}
              </ul>
            ))}
        </CardContent>
      </Card>

      {userCan(user, 'scoutYear.manage') && (
        <Card>
          <CardHeader>
            <CardTitle>Années scoutes</CardTitle>
            <CardDescription>
              {d.scoutYears.map((year) => year.label).join(', ') || 'Aucune année déclarée.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoutYearForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
