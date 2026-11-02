import type { Metadata } from 'next';
import { AccountCredentialFlow } from '@/components/auth/account-credential-flow';
import { AccountPageShell } from '@/components/auth/account-page-shell';

export const metadata: Metadata = { title: 'Activer mon compte', robots: { index: false } };

/**
 * Inscription privée sur invitation (D162) : lien `/inscription#<jeton>` ou e-mail et code transmis
 * par une personne habilitée. Aucune inscription libre ; le compte reste lié à sa fiche existante.
 */
export default function InscriptionPage() {
  return (
    <AccountPageShell>
      <AccountCredentialFlow purpose="ACTIVATION" />
    </AccountPageShell>
  );
}
