import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

/** Cadre des pages publiques de compte (inscription, récupération) : logo, carte, retour connexion. */
export function AccountPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 py-12 sm:items-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} />
          <p className="font-semibold text-tesla-bordeaux">Nikola Tesla Académie</p>
        </div>
        {children}
        <p className="text-center text-sm">
          <Link
            href="/connexion"
            className="text-muted-foreground underline-offset-4 hover:text-tesla-rouge hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
