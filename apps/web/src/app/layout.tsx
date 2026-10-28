import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Nikola Tesla Académie', template: '%s · Nikola Tesla Académie' },
  description:
    'Plateforme pédagogique de la Communauté Nikola Tesla — Branche Route, District Requin de Sable, Abidjan.',
  applicationName: 'Nikola Tesla Académie',
  appleWebApp: { capable: true, title: 'Tesla Académie', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
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
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
