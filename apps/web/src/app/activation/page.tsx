import type { Metadata } from 'next';
import { AccountPageShell } from '@/components/auth/account-page-shell';
import { LegacyLinkRedirect } from './activation-form';

export const metadata: Metadata = { title: 'Lien de compte', robots: { index: false } };

/**
 * Anciens liens `/activation#<jeton>` (émis avant D162) : renvoyés vers la page de leur finalité,
 * le jeton restant dans le fragment.
 */
export default function ActivationPage() {
  return (
    <AccountPageShell>
      <LegacyLinkRedirect />
    </AccountPageShell>
  );
}
