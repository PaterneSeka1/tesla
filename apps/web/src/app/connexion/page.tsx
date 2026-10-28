import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-tesla-sable/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo size={80} className="mx-auto mb-2" />
          <CardTitle className="text-xl">Connexion</CardTitle>
          <CardDescription>Accédez à votre espace Nikola Tesla Académie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-center text-sm">
            <Link href="/" className="text-tesla-rouge underline-offset-4 hover:underline">
              Retour à l’accueil
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
