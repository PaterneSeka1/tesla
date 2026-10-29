import { BookOpen, CloudDownload, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { ApiStatus } from '@/components/api-status';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    title: 'Modules pédagogiques',
    description: 'Leçons approuvées par le responsable pédagogique, consultables à tout moment.',
    icon: BookOpen,
  },
  {
    title: 'Lecture hors ligne',
    description: 'Modules téléchargés et chiffrés sur l’appareil, lisibles sans connexion.',
    icon: CloudDownload,
  },
  {
    title: 'Progression routière',
    description: 'Évaluations, résultats et compétences suivis tout au long de l’année scoute.',
    icon: GraduationCap,
  },
] as const;

/**
 * Accueil public. Un utilisateur connecté n'y reste pas : le proxy l'envoie vers `/connexion`, qui
 * l'oriente vers le tableau de bord de son rôle. Aucun choix d'espace n'est proposé.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-tesla-bordeaux text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-14 text-center sm:py-20">
          <BrandLogo size={120} className="shadow-lg ring-4 ring-tesla-or/40" />
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-tesla-or uppercase sm:text-sm">
              Communauté Nikola Tesla · Branche Route · Abidjan
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Nikola Tesla Académie</h1>
            <p className="mx-auto max-w-2xl text-tesla-sable">
              La plateforme d’apprentissage de la communauté pour l’année scoute 2026–2027.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-tesla-or text-tesla-bordeaux hover:bg-tesla-or/90"
            >
              <Link href="/connexion">Se connecter</Link>
            </Button>
            <ApiStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <li key={title} className="rounded-xl border bg-card p-5 shadow-xs">
              <Icon className="mb-3 size-6 text-tesla-rouge" aria-hidden />
              <h2 className="font-semibold text-tesla-bordeaux">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          Après connexion, chacun arrive directement sur son tableau de bord.
        </p>
      </main>
    </div>
  );
}
