import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { ActivationForm } from './activation-form';

export const metadata: Metadata = { title: 'Choisir un mot de passe', robots: { index: false } };

/** Lien d'activation ou de réinitialisation (`/activation#<jeton>`), transmis par une personne habilitée. */
export default function ActivationPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 py-12 sm:items-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} />
          <p className="font-semibold text-tesla-bordeaux">Nikola Tesla Académie</p>
        </div>
        <ActivationForm />
        <p className="text-center text-sm">
          <Link
            href="/connexion"
            className="text-muted-foreground underline-offset-4 hover:text-tesla-rouge hover:underline"
          >
            Aller à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
