import type { Metadata } from 'next';
import { AccountPageShell } from '@/components/auth/account-page-shell';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AccountPageShell>
      <ForgotPasswordForm />
    </AccountPageShell>
  );
}
