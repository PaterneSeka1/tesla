import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandLogo size={88} />
      <p className="text-sm font-medium text-tesla-rouge">Erreur 404</p>
      <h1 className="text-2xl font-semibold text-tesla-bordeaux">Page introuvable</h1>
      <p className="max-w-md text-muted-foreground">
        Ce chemin ne mène nulle part. Vérifiez l’adresse ou revenez à l’accueil.
      </p>
      <Button asChild>
        <Link href="/">Retour à l’accueil</Link>
      </Button>
    </main>
  );
}
