import type { Metadata } from 'next';
import { AccountCredentialFlow } from '@/components/auth/account-credential-flow';
import { AccountPageShell } from '@/components/auth/account-page-shell';

export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false } };

/** Récupération (D166) : lien `/reinitialiser-mot-de-passe#<jeton>` ou e-mail et code reçus. */
export default function ResetPasswordPage() {
  return (
    <AccountPageShell>
      <AccountCredentialFlow purpose="REINITIALISATION" />
    </AccountPageShell>
  );
}
