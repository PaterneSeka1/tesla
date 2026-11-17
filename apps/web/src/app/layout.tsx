import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Providers } from '@/components/providers';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { INSTALL_CAPTURE_SCRIPT } from '@/lib/pwa-install';
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_OPEN_GRAPH,
  SITE_SHORT_NAME,
  SITE_URL,
} from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'Communauté Nikola Tesla' }],
  creator: 'Communauté Nikola Tesla',
  publisher: 'Communauté Nikola Tesla',
  category: 'education',
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: SITE_OPEN_GRAPH,
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: SITE_DESCRIPTION },
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  // Next 16 n'émet que `mobile-web-app-capable` : iOS antérieur à 16.4 exige encore la balise Apple
  // pour ouvrir l'application installée en plein écran (D184).
  other: { 'apple-mobile-web-app-capable': 'yes' },
  // Par défaut rien n'est indexé : seules les pages publiques l'autorisent (`INDEXABLE_PATHS`).
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
