import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(import.meta.dirname, '../..');

// Le fichier .env unique se trouve à la racine du monorepo (variables déjà définies prioritaires).
const rootEnvFile = path.join(monorepoRoot, '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  agentRules: false, // consignes agents centralisées dans AGENTS.md / CLAUDE.md à la racine
  turbopack: {
    root: monorepoRoot,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  /** Espace unique de l'encadrement (D105) : les anciennes adresses restent valides. */
  async redirects() {
    return [
      { source: '/chef', destination: '/encadrement', permanent: false },
      { source: '/chef/:path*', destination: '/encadrement/:path*', permanent: false },
      { source: '/responsable', destination: '/encadrement', permanent: false },
      /** Offline-first (D116) : la gestion de l'appareil remplace l'onglet « Hors ligne ». */
      { source: '/telechargements', destination: '/appareil', permanent: false },
      { source: '/synchronisation', destination: '/appareil', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Directives sans effet sur les scripts de Next.js (une CSP de scripts exigerait des nonces) ;
          // HSTS est posé par Nginx, qui termine TLS.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
