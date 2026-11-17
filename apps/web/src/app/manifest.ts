import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_SHORT_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identité stable de l'application installée, indépendante de `start_url`.
    id: '/',
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: 'Plateforme pédagogique de la Communauté Nikola Tesla — Branche Route, Abidjan.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FCF9F4',
    theme_color: '#510D12',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
