'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  LEADER_FUNCTION_LABELS,
  LEADER_FUNCTIONS,
  type LeadershipAdmin,
  type LeadershipAssignment,
  type LeadershipMember,
  type UserSummary,
} from '@tesla/shared';
import { Network, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  assignLeader,
  endLeader,
  leadershipAdminQueryOptions,
  leadershipTeamQueryOptions,
} from '@/lib/api/leadership';
import { formatDate } from '@/lib/format';
import { userCan } from '@/lib/navigation';

const name = (user: UserSummary) => `${user.firstName} ${user.lastName}`;

/**
 * Encadrement de la communauté (D132) : composition visible de tous ; l'administrateur désigne
 * le responsable plein, l'adjoint et les assistants, et consulte l'historique. Aucun mandat,
 * aucune année, aucune délégation.
 */
export function CommunityLeadership() {
  const user = useSessionUser();
  return userCan(user, 'leadership.manage') ? <LeadershipAdministration /> : <LeadershipTeam />;
}

function LeadershipTeam() {
  const team = useQuery(leadershipTeamQueryOptions);
  if (team.isPending) return <TableSkeleton rows={3} />;
  if (team.error) return <QueryError error={team.error} onRetry={() => void team.refetch()} />;
  return <TeamCard members={team.data.members} />;
}

/** Composition actuelle, avec une alerte si aucun responsable plein n'est désigné. */
export function TeamCard({
  members,
  actions,
}: {
  members: LeadershipMember[];
  actions?: (member: LeadershipMember) => React.ReactNode;
}) {
  const vacant = !members.some((member) => member.function === 'PLEIN');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Encadrement de la communauté</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vacant && (
          <Alert variant="info">
            <UserX aria-hidden />
            <AlertDescription>
              Aucun responsable plein désigné : les décisions officielles sont en attente.
            </AlertDescription>
          </Alert>
        )}
        {members.length === 0 ? (
          <EmptyState icon={Network} title="Aucun membre de l’encadrement désigné" />
        ) : (
          <ul className="stagger space-y-2">
            {members.map((member) => (
              <li
                key={member.assignmentId}
                className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {name(member.user)}
                    <Badge variant={member.function === 'PLEIN' ? 'default' : 'secondary'}>
                      {LEADER_FUNCTION_LABELS[member.function]}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Depuis le {formatDate(member.since)}
                  </p>
                </div>
                {actions && <div className="flex shrink-0 gap-2">{actions(member)}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LeadershipAdministration() {
  const admin = useQuery(leadershipAdminQueryOptions);
  if (admin.isPending) return <TableSkeleton rows={6} />;
  if (admin.error) return <QueryError error={admin.error} onRetry={() => void admin.refetch()} />;
  const d = admin.data;
  return (
    <div className="space-y-6">
      <TeamCard members={d.members} actions={(member) => <EndButton member={member} />} />
      <AssignForm data={d} />
      <History rows={d.history} />
    </div>
  );
}

// ─── Désignation ────────────────────────────────────────────────────────────

const assignFormSchema = z.object({
  userId: z.uuid({ error: 'Choisissez une personne.' }),
  function: z.enum(LEADER_FUNCTIONS, { error: 'Choisissez une fonction.' }),
  reason: z.string().trim().max(500, { error: '500 caractères au maximum.' }),
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

function AssignForm({ data }: { data: LeadershipAdmin }) {
  const run = usePedagogyAction();
  const [pending, setPending] = useState<AssignFormValues | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: { userId: '', function: 'ASSISTANT', reason: '' },
  });
  const plein = data.members.find((member) => member.function === 'PLEIN');
  const person = data.staff.find((member) => member.id === pending?.userId);
  const replaced =
    pending?.function === 'PLEIN' && plein && plein.user.id !== pending.userId ? plein : null;

  const confirm = async () => {
    if (!pending) return;
    const ok = await run(
      () =>
        assignLeader({
          userId: pending.userId,
          function: pending.function,
          reason: pending.reason,
          confirmReplacement: replaced !== null,
        }),
      { success: 'Fonction enregistrée.', error: 'Fonction non enregistrée.' },
    );
    if (ok) {
      setPending(null);
      reset();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Désigner une personne</CardTitle>
      </CardHeader>
      <CardContent>
        {data.staff.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Aucun compte d’encadrement actif"
            description="Créez d’abord le compte depuis « Comptes »."
          />
        ) : (
          <form
            noValidate
            onSubmit={(event) => void handleSubmit(setPending)(event)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField id="leader-user" label="Personne" required error={errors.userId?.message}>
              <NativeSelect
                {...fieldA11y('leader-user', errors.userId?.message)}
                {...register('userId')}
              >
                <option value="">Choisir…</option>
                {data.staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {name(member)}
                    {member.currentFunction &&
                      ` (${LEADER_FUNCTION_LABELS[member.currentFunction]})`}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="leader-function"
              label="Fonction"
              required
              error={errors.function?.message}
            >
              <NativeSelect
                {...fieldA11y('leader-function', errors.function?.message)}
                {...register('function')}
              >
                {LEADER_FUNCTIONS.map((fn) => (
                  <option key={fn} value={fn}>
                    {LEADER_FUNCTION_LABELS[fn]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="leader-reason" label="Motif ou référence" error={errors.reason?.message}>
              <Textarea
                rows={2}
                {...fieldA11y('leader-reason', errors.reason?.message)}
                {...register('reason')}
              />
            </FormField>
            <div className="flex items-end">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        )}
      </CardContent>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la désignation</DialogTitle>
            <DialogDescription>
              {person ? name(person) : 'Cette personne'} devient{' '}
              {pending && LEADER_FUNCTION_LABELS[pending.function].toLowerCase()}.
              {person?.currentFunction &&
                ` Sa fonction actuelle (${LEADER_FUNCTION_LABELS[person.currentFunction].toLowerCase()}) prend fin.`}
              {replaced &&
                ` ${name(replaced.user)} n’est plus responsable plein : ses décisions officielles cessent immédiatement ; son compte et son accès à l’encadrement sont conservés.`}
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
    </Card>
  );
}

function EndButton({ member }: { member: LeadershipMember }) {
  const run = usePedagogyAction();
  const [reason, setReason] = useState('');
  const id = `end-${member.assignmentId}`;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          Mettre fin
        </Button>
      }
      title={`Fin de fonction de ${name(member.user)}`}
      confirmLabel="Mettre fin"
      destructive
      description={
        <FormField id={id} label="Motif" required>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            {...fieldA11y(id)}
          />
        </FormField>
      }
      onConfirm={() =>
        run(() => endLeader(member.assignmentId, { reason }), {
          success: 'Fin de fonction enregistrée.',
          error: 'Fin de fonction non enregistrée.',
        })
      }
    />
  );
}

// ─── Historique ─────────────────────────────────────────────────────────────

function History({ rows }: { rows: LeadershipAssignment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={Network} title="Aucun changement enregistré" />
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border bg-card p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {name(row.user)}
                  <Badge variant="outline">{LEADER_FUNCTION_LABELS[row.function]}</Badge>
                  {!row.endedAt && <Badge variant="success">En fonction</Badge>}
                </p>
                <p className="text-muted-foreground">
                  Depuis le {formatDate(row.startedAt)}
                  {row.endedAt && ` jusqu’au ${formatDate(row.endedAt)}`}
                  {row.assignedBy && ` · désigné par ${name(row.assignedBy)}`}
                  {row.reason && ` · ${row.reason}`}
                  {row.endReason && ` · fin : ${row.endReason}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
