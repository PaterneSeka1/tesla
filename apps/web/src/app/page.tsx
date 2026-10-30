import {
  ArrowRight,
  BookOpen,
  CloudDownload,
  Compass,
  GraduationCap,
  type LucideIcon,
  UserCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { BrandBackdrop, BrandCurve } from '@/components/brand-backdrop';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

/** Délai d'apparition en cascade (voir `.animate-rise` dans globals.css). */
const stagger = (index: number) => ({ '--stagger': index }) as React.CSSProperties;

const FEATURES: readonly { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: 'Modules pédagogiques',
    description: 'Leçons approuvées par le responsable plein, consultables à tout moment.',
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
];

/** Ce que chacun trouve dans l'application, selon sa place dans la communauté (aucun espace à choisir). */
const JOURNEY: readonly { title: string; items: readonly string[]; icon: LucideIcon }[] = [
  {
    title: 'Apprendre',
    icon: Compass,
    items: [
      'Lire les modules, même sans réseau',
      'Passer ses évaluations en ligne ou sur papier',
      'Suivre sa progression et ses compétences',
    ],
  },
  {
    title: 'Accompagner',
    icon: UsersRound,
    items: [
      'Rédiger modules et questionnaires',
      'Corriger les copies et noter des observations',
      'Proposer la validation d’une compétence',
    ],
  },
  {
    title: 'Décider',
    icon: UserCheck,
    items: [
      'Approuver et publier les contenus',
      'Examiner les résultats et valider les acquis',
      'Piloter l’année et accompagner chaque routier',
    ],
  },
];

/**
 * Accueil public. Un utilisateur connecté n'y reste pas : le proxy l'envoie vers `/connexion`, qui
 * l'oriente vers l'accueil commun. Aucun choix d'espace n'est proposé.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative isolate overflow-hidden bg-tesla-bordeaux text-white">
        <BrandBackdrop className="-z-10" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 pt-12 pb-10 text-center sm:pt-16 sm:pb-14">
          <div className="animate-rise">
            <BrandLogo size={120} className="animate-halo ring-4 ring-tesla-or/40" />
          </div>
          <div className="space-y-3">
            <p
              className="animate-rise inline-flex items-center gap-1.5 text-xs tracking-[0.2em] text-tesla-or uppercase sm:text-sm"
              style={stagger(1)}
            >
              <Zap className="size-3.5" aria-hidden />
              Communauté Nikola Tesla · Branche Route · Abidjan
            </p>
            <h1
              className="animate-rise text-4xl font-bold tracking-tight sm:text-5xl"
              style={stagger(2)}
            >
              Nikola Tesla <span className="text-tesla-or">Académie</span>
            </h1>
            <p className="animate-rise mx-auto max-w-2xl text-tesla-sable" style={stagger(3)}>
              Apprendre, être évalué et progresser, en ligne comme hors ligne.
            </p>
          </div>
          <div
            className="animate-rise flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
            style={stagger(4)}
          >
            <Button
              asChild
              size="lg"
              className="group w-full bg-tesla-or text-tesla-bordeaux shadow-lg transition-transform hover:bg-tesla-or/90 active:scale-95 sm:w-auto"
            >
              <Link href="/connexion">
                Se connecter
                <ArrowRight
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </Button>
          </div>
        </div>
        <BrandCurve />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-14 px-4 py-10">
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon }, index) => (
            <li
              key={title}
              className="animate-rise rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-1 hover:border-tesla-or hover:shadow-md"
              style={stagger(index + 5)}
            >
              <span className="mb-3 inline-flex rounded-lg bg-tesla-sable/60 p-2 text-tesla-rouge">
                <Icon className="size-6" aria-hidden />
              </span>
              <h2 className="font-semibold text-tesla-bordeaux">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="roles-title" className="space-y-5">
          <h2 id="roles-title" className="text-center text-2xl font-bold text-tesla-bordeaux">
            Une seule application pour toute la communauté
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {JOURNEY.map(({ title, items, icon: Icon }, index) => (
              <li
                key={title}
                className="animate-rise relative overflow-hidden rounded-xl bg-tesla-bordeaux p-5 text-white shadow-sm"
                style={stagger(index + 8)}
              >
                <span
                  className="absolute -top-10 -right-10 size-28 rounded-full bg-tesla-or/15"
                  aria-hidden
                />
                <Icon className="mb-3 size-7 text-tesla-or" aria-hidden />
                <h3 className="text-lg font-semibold">{title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-tesla-sable">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tesla-or"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>Communauté Nikola Tesla · Branche Route · District Requin de Sable</p>
          <p>Année scoute 2026–2027</p>
        </div>
      </footer>
    </div>
  );
}
