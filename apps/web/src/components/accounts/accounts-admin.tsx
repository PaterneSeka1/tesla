'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Account,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUSES,
  type AccountLink,
  type AccountStatus,
  type Role,
  ROLE_LABELS,
} from '@tesla/shared';
import { KeyRound, LogOut, Plus, Power, Search, UserRound } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import {
  accountsQueryOptions,
  createAccount,
  deactivateAccount,
  issueAccountLink,
  reactivateAccount,
  revokeAccountSessions,
} from '@/lib/api/accounts';
import { AccountLinkDialog } from './account-link-dialog';
import { formatDateTime, fullName } from '@/lib/format';
import { userCan } from '@/lib/navigation';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<AccountStatus, 'success' | 'outline' | 'secondary'> = {
  ACTIF: 'success',
  A_ACTIVER: 'secondary',
  DESACTIVE: 'outline',
};

/**
 * Comptes du périmètre de l'utilisateur (vérifié par l'API) : tous pour l'administration technique,
 * comptes routiers pour une décision officielle. Les comptes routiers liés à une fiche se créent de
 * préférence depuis la fiche (rattachement immédiat).
 */
export function AccountsAdmin() {
  const user = useSessionUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState<{ link: AccountLink; name: string } | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const canManage = userCan(user, 'account.manage');
  const roles: Role[] =
    user.role === 'ADMINISTRATEUR' ? ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR'] : ['ROUTIER'];

  const { data, error, isPending, refetch } = useQuery({
    ...accountsQueryOptions({
      search: deferredSearch,
      status: status || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  /** Exécute l'action, rafraîchit la liste et notifie ; renvoie `true` en cas de succès. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(success);
      return true;
    } catch (failure) {
      toast.error('Opération impossible', failure instanceof Error ? failure.message : undefined);
      return false;
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Comptes" />
        {canManage && (
          <CreateAccount roles={roles} onCreated={(link, name) => setShown({ link, name })} />
        )}
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="account-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="account-search"
              type="search"
              className="pl-9"
              placeholder="Nom ou adresse e-mail"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="account-status">Statut</Label>
          <NativeSelect
            id="account-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AccountStatus | '');
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {ACCOUNT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>

      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aucun compte"
          description={
            deferredSearch || status ? 'Modifiez la recherche ou les filtres.' : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableCaption>Liste des comptes</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Titulaire</TableHead>
                <TableHead className="hidden md:table-cell">Accès</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Dernière connexion</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <p className="font-medium">{fullName(account)}</p>
                    <p className="text-xs break-all text-muted-foreground">{account.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {ROLE_LABELS[account.role]}
                    {account.role === 'ROUTIER' && !account.scoutProfileId && (
                      <p className="text-xs text-muted-foreground">Sans fiche rattachée</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[account.status]}>
                      {ACCOUNT_STATUS_LABELS[account.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : '—'}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <AccountActions
                        account={account}
                        self={account.id === user.id}
                        run={run}
                        onLink={(link) => setShown({ link, name: fullName(account) })}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
      <AccountLinkDialog
        link={shown?.link ?? null}
        name={shown?.name ?? ''}
        onClose={() => setShown(null)}
      />
    </>
  );
}

function CreateAccount({
  roles,
  onCreated,
}: {
  roles: Role[];
  onCreated: (link: AccountLink, name: string) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const empty = { email: '', firstName: '', lastName: '', role: roles[0]! };
  const [values, setValues] = useState(empty);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  return (
    <ConfirmDialog
      trigger={
        <Button>
          <Plus aria-hidden />
          Nouveau compte
        </Button>
      }
      title="Nouveau compte"
      description={
        <>
          <p>
            Le compte est créé sans mot de passe : un lien d’activation à usage unique vous sera
            remis. Pour un routier déjà inscrit, créez plutôt le compte depuis sa fiche.
          </p>
          <FormField id="account-email" label="Adresse e-mail" required>
            <Input
              id="account-email"
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={set('email')}
            />
          </FormField>
          <FormField id="account-first-name" label="Prénom" required>
            <Input id="account-first-name" value={values.firstName} onChange={set('firstName')} />
          </FormField>
          <FormField id="account-last-name" label="Nom" required>
            <Input id="account-last-name" value={values.lastName} onChange={set('lastName')} />
          </FormField>
          {roles.length > 1 && (
            <FormField id="account-role" label="Type de compte" required>
              <NativeSelect id="account-role" value={values.role} onChange={set('role')}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
        </>
      }
      confirmLabel="Créer le compte"
      onConfirm={async () => {
        try {
          const created = await createAccount(values);
          await queryClient.invalidateQueries({ queryKey: ['accounts'] });
          setValues(empty);
          onCreated(created.link, fullName(created.account));
          return true;
        } catch (failure) {
          toast.error(
            'Création impossible',
            failure instanceof Error ? failure.message : undefined,
          );
          return false;
        }
      }}
    />
  );
}

function AccountActions({
  account,
  self,
  run,
  onLink,
}: {
  account: Account;
  self: boolean;
  run: (action: () => Promise<unknown>, success: string) => Promise<boolean>;
  onLink: (link: AccountLink) => void;
}) {
  const [reason, setReason] = useState('');
  const name = fullName(account);
  const active = account.status !== 'DESACTIVE';
  return (
    <div className="flex flex-wrap gap-2">
      {active && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <KeyRound aria-hidden />
              {account.status === 'A_ACTIVER' ? 'Lien d’activation' : 'Réinitialiser'}
            </Button>
          }
          title={
            account.status === 'A_ACTIVER'
              ? 'Nouveau lien d’activation'
              : 'Réinitialiser le mot de passe'
          }
          description={
            <p>
              Un nouveau lien à usage unique sera émis pour {name} ; les liens précédents cessent de
              fonctionner. Le mot de passe actuel reste valable jusqu’à l’utilisation du lien.
            </p>
          }
          confirmLabel="Émettre le lien"
          onConfirm={() =>
            run(async () => onLink((await issueAccountLink(account.id)).link), 'Lien émis')
          }
        />
      )}
      {active && account.activeSessions > 0 && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <LogOut aria-hidden />
              Fermer les sessions
            </Button>
          }
          title="Fermer les sessions ?"
          description={
            <p>
              {name} sera déconnecté de tous ses appareils ({account.activeSessions} session(s)).
            </p>
          }
          confirmLabel="Fermer les sessions"
          onConfirm={() => run(() => revokeAccountSessions(account.id), 'Sessions fermées')}
        />
      )}
      {!self && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <Power aria-hidden />
              {active ? 'Désactiver' : 'Réactiver'}
            </Button>
          }
          title={active ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
          description={
            active ? (
              <>
                <p>
                  {name} ne pourra plus se connecter ; ses sessions et liens en attente sont
                  révoqués. Aucune donnée n’est supprimée ; la fiche routier éventuelle est
                  conservée.
                </p>
                <FormField id={`reason-${account.id}`} label="Motif" required>
                  <Textarea
                    id={`reason-${account.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </FormField>
              </>
            ) : (
              <p>{name} pourra de nouveau se connecter avec son mot de passe.</p>
            )
          }
          confirmLabel={active ? 'Désactiver' : 'Réactiver'}
          destructive={active}
          onConfirm={async () => {
            const ok = active
              ? await run(() => deactivateAccount(account.id, { reason }), 'Compte désactivé')
              : await run(() => reactivateAccount(account.id), 'Compte réactivé');
            if (ok) setReason('');
            return ok;
          }}
        />
      )}
    </div>
  );
}
