import { BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ApiStatus } from '@/components/api-status';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SPACE_LINKS = [
  {
    href: '/routier',
    title: 'Espace routier',
    description: 'Consulter les modules, lire hors ligne et suivre sa progression.',
    icon: BookOpen,
  },
  {
    href: '/chef',
    title: 'Espace chef',
    description: 'Rédiger les modules et les soumettre à l’approbation du responsable.',
    icon: GraduationCap,
  },
  {
    href: '/responsable',
    title: 'Espace responsable pédagogique',
    description: 'Approuver les publications, accorder les déblocages, valider les acquis.',
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-tesla-bordeaux text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-12 text-center sm:py-16">
          <BrandLogo size={128} className="shadow-lg ring-4 ring-tesla-or/40" />
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-tesla-or">
              Communauté Nikola Tesla · Branche Route · Abidjan
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">Nikola Tesla Académie</h1>
            <p className="mx-auto max-w-2xl text-tesla-sable">
              La plateforme d’apprentissage de la communauté pour l’année scoute 2026–2027 : modules
              pédagogiques, lecture hors ligne et suivi de la progression routière.
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="mb-4 text-xl font-semibold text-tesla-bordeaux">Espaces de la plateforme</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {SPACE_LINKS.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="block h-full rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <Icon className="mb-2 size-6 text-tesla-rouge" aria-hidden />
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Version de fondation : les espaces présentent leur structure. Les contenus, la connexion
          et les évaluations seront activés progressivement.
        </p>
      </main>
    </div>
  );
}
