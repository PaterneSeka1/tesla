import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Providers } from '@/components/providers';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { INSTALL_CAPTURE_SCRIPT } from '@/lib/pwa-install';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Nikola Tesla Académie', template: '%s · Nikola Tesla Académie' },
  description:
    'Plateforme pédagogique de la Communauté Nikola Tesla — Branche Route, District Requin de Sable, Abidjan.',
  applicationName: 'Nikola Tesla Académie',
  appleWebApp: { capable: true, title: 'Tesla Académie', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  // Next 16 n'émet que `mobile-web-app-capable` : iOS antérieur à 16.4 exige encore la balise Apple
  // pour ouvrir l'application installée en plein écran (D184).
  other: { 'apple-mobile-web-app-capable': 'yes' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#510D12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        {/* Capte l'invitation d'installation native avant le démarrage de React (D184). */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
        {/* Dépend de l'adresse : hors du rendu statique (cacheComponents). */}
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      </body>
    </html>
  );
}
