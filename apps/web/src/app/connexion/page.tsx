import { BookOpen, CloudDownload, GraduationCap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BrandBackdrop } from '@/components/brand-backdrop';
import { BrandLogo } from '@/components/brand-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

const stagger = (index: number) => ({ '--stagger': index }) as React.CSSProperties;

const HIGHLIGHTS = [
  { label: 'Modules approuvés, lisibles hors ligne', icon: BookOpen },
  { label: 'Évaluations en ligne ou sur papier', icon: CloudDownload },
  { label: 'Progression suivie toute l’année', icon: GraduationCap },
] as const;

/**
 * Connexion. Mobile : bandeau de marque puis carte du formulaire qui remonte par-dessus.
 * Desktop : panneau de marque à gauche, formulaire à droite.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <section className="relative isolate overflow-hidden bg-tesla-bordeaux px-6 pt-12 pb-20 text-white lg:flex lg:flex-col lg:justify-center lg:p-12">
        <BrandBackdrop className="-z-10" />
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <div className="animate-rise">
            <BrandLogo size={88} className="animate-halo ring-4 ring-tesla-or/40" />
          </div>
          <p className="animate-rise text-2xl font-bold sm:text-3xl" style={stagger(1)}>
            Nikola Tesla <span className="text-tesla-or">Académie</span>
          </p>
          <ul className="hidden space-y-3 pt-4 lg:block">
            {HIGHLIGHTS.map(({ label, icon: Icon }, index) => (
              <li
                key={label}
                className="animate-rise flex items-center gap-3 text-tesla-sable"
                style={stagger(index + 2)}
              >
                <span className="rounded-lg bg-white/10 p-2 text-tesla-or">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="relative -mt-10 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center">
        <div
          className="animate-rise w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl lg:shadow-none lg:border-0 lg:bg-transparent"
          style={stagger(2)}
        >
          <h1 className="mb-6 text-xl font-semibold text-tesla-bordeaux">Connexion</h1>
          <Suspense fallback={<Skeleton className="h-56" />}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-sm">
            <Link
              href="/"
              className="text-muted-foreground underline-offset-4 hover:text-tesla-rouge hover:underline"
            >
              Retour à l’accueil
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
