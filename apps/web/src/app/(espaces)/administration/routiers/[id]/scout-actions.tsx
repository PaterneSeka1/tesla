'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type AccountLink, type ScoutDetail } from '@tesla/shared';
import { ArrowRightLeft, Link2, Power, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { AccountLinkDialog } from '@/components/accounts/account-link-dialog';
import { useSessionUser } from '@/components/auth/session-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { OFFLINE_SAVED } from '@/components/progression/use-pedagogy-action';
import { useToast } from '@/components/ui/toaster';
import { OfflineQueuedError } from '@/lib/offline/operations';
import { createAccount } from '@/lib/api/accounts';
import { assignTeam, linkAccount, setScoutActive, unassignTeam } from '@/lib/api/scouts';
import { userCan } from '@/lib/navigation';
import { activeTeamsQueryOptions } from '@/lib/api/teams';
import { fullName } from '@/lib/format';

/** Actions du responsable sur une fiche ; chacune est confirmée et vérifiée par l'API. */
export function ScoutActions({ scout }: { scout: ScoutDetail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const teams = useQuery(activeTeamsQueryOptions);
  const [teamId, setTeamId] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [link, setLink] = useState<AccountLink | null>(null);
  const user = useSessionUser();
  const name = fullName(scout);

  /** Exécute l'action, rafraîchit les données et notifie ; renvoie `true` en cas de succès. */
  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['scouts'] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(success);
      return true;
    } catch (error) {
      if (error instanceof OfflineQueuedError) {
        toast.success(OFFLINE_SAVED.title, OFFLINE_SAVED.detail);
        return true;
      }
      toast.error(failure, error instanceof Error ? error.message : undefined);
      return false;
    }
  };

  const otherTeams = teams.data?.items.filter((team) => team.id !== scout.team?.id) ?? [];
  const targetTeam = otherTeams.find((team) => team.id === teamId);

  return (
    <>
      {scout.isActive && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <ArrowRightLeft aria-hidden />
              {scout.team ? 'Changer d’équipe' : 'Affecter à une équipe'}
            </Button>
          }
          title={scout.team ? 'Changer d’équipe' : 'Affecter à une équipe'}
          description={
            <>
              <p>
                {scout.team
                  ? `L’affectation à « ${scout.team.name} » sera clôturée aujourd’hui et conservée dans l’historique.`
                  : `${name} n’a actuellement aucune équipe.`}
              </p>
              <FormField id="assign-team" label="Nouvelle équipe" required>
                <NativeSelect
                  id="assign-team"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">Choisir une équipe</option>
                  {otherTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </>
          }
          confirmLabel="Confirmer l’affectation"
          onConfirm={async () => {
            if (!targetTeam) {
              toast.error('Choisissez une équipe.');
              return false;
            }
            const ok = await run(
              () =>
                assignTeam(
                  scout.id,
                  { teamId: targetTeam.id, expectedTeamId: scout.team?.id ?? null },
                  `${name} → « ${targetTeam.name} »`,
                ),
              `${name} rejoint « ${targetTeam.name} »`,
              'Affectation impossible',
            );
            if (ok) setTeamId('');
            return ok;
          }}
        />
      )}

      {scout.team && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <UserMinus aria-hidden />
              Retirer de l’équipe
            </Button>
          }
          title="Retirer de l’équipe ?"
          description={
            <p>
              {name} sera retiré de « {scout.team.name} » et restera sans équipe. L’affectation est
              clôturée, pas supprimée.
            </p>
          }
          confirmLabel="Retirer"
          destructive
          onConfirm={() =>
            run(() => unassignTeam(scout.id), 'Routier retiré de l’équipe', 'Retrait impossible')
          }
        />
      )}

      {!scout.hasAccount && userCan(user, 'account.manage') && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <UserPlus aria-hidden />
              Créer son compte
            </Button>
          }
          title="Créer le compte de ce routier"
          description={
            <>
              <p>
                Un compte routier sera créé et rattaché à cette fiche, qui garde son historique. Un
                lien d’activation à usage unique vous sera remis pour {name}.
              </p>
              <FormField id="new-account-email" label="Adresse e-mail du routier" required>
                <Input
                  id="new-account-email"
                  type="email"
                  autoComplete="off"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </FormField>
            </>
          }
          confirmLabel="Créer le compte"
          onConfirm={async () => {
            let created: AccountLink | null = null;
            const ok = await run(
              async () => {
                created = (
                  await createAccount({
                    email: newEmail,
                    firstName: scout.firstName,
                    lastName: scout.lastName,
                    role: 'ROUTIER',
                    scoutProfileId: scout.id,
                  })
                ).link;
              },
              'Compte créé et rattaché',
              'Création impossible',
            );
            if (ok) {
              setNewEmail('');
              setLink(created);
            }
            return ok;
          }}
        />
      )}

      {!scout.hasAccount && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <Link2 aria-hidden />
              Rattacher un compte
            </Button>
          }
          title="Rattacher un compte existant"
          description={
            <>
              <p>
                Le compte routier indiqué sera lié à cette fiche. La fiche, son historique et ses
                résultats sont conservés ; aucun nouveau profil n’est créé. Vérifiez qu’il s’agit
                bien de {name}.
              </p>
              <FormField id="link-email" label="Adresse e-mail du compte routier" required>
                <Input
                  id="link-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
            </>
          }
          confirmLabel="Rattacher"
          onConfirm={async () => {
            const ok = await run(
              () => linkAccount(scout.id, { email }),
              'Compte rattaché',
              'Rattachement impossible',
            );
            if (ok) setEmail('');
            return ok;
          }}
        />
      )}

      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <Power aria-hidden />
            {scout.isActive ? 'Désactiver' : 'Réactiver'}
          </Button>
        }
        title={scout.isActive ? 'Désactiver ce profil ?' : 'Réactiver ce profil ?'}
        description={
          scout.isActive ? (
            <p>
              {name} n’apparaîtra plus parmi les routiers actifs.
              {scout.team && ` Son affectation à « ${scout.team.name} » sera clôturée.`} Aucune
              donnée n’est supprimée.
            </p>
          ) : (
            <p>
              {name} réapparaîtra parmi les routiers actifs (sans équipe : affectez-le ensuite).
            </p>
          )
        }
        confirmLabel={scout.isActive ? 'Désactiver' : 'Réactiver'}
        destructive={scout.isActive}
        onConfirm={() =>
          run(
            () => setScoutActive(scout.id, !scout.isActive),
            scout.isActive ? 'Profil désactivé' : 'Profil réactivé',
            'Opération impossible',
          )
        }
      />
      <AccountLinkDialog link={link} name={name} onClose={() => setLink(null)} />
    </>
  );
}
