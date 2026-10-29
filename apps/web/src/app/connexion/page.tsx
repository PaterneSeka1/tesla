import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Skeleton } from '@/components/ui/skeleton';
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
          <CardDescription>Accédez à votre tableau de bord Nikola Tesla Académie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<Skeleton className="h-56" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
