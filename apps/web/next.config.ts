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
