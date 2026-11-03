import type { ApiErrorBody } from '@tesla/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Relais même origine de l'API (web sur Vercel, API sur le VPS) : le navigateur appelle
 * `/api/v1/...` sur le domaine du web, Vercel transmet la requête à `TESLA_API_ORIGIN` sans la
 * mettre en cache. Le cookie de session reste propre au domaine du web (SameSite=Lax, aucun
 * cookie tiers), l'en-tête `Origin` et l'en-tête anti-CSRF sont transmis tels quels : l'API garde
 * ses contrôles (CORS_ORIGINS = origine du web).
 *
 * Adresse du client : derrière Vercel, l'API ne voit que des adresses de Vercel. Le relais transmet
 * l'adresse établie par Vercel (`x-forwarded-for`, réécrit par Vercel, jamais celui du client) dans
 * `x-tesla-client-ip`, avec le secret partagé `x-tesla-proxy-secret` : Nginx ne retient cette
 * adresse que si le secret est exact (deploy/nginx/tesla-api.conf), puis retire les deux en-têtes.
 * Variables serveur uniquement, jamais `NEXT_PUBLIC_` : TESLA_API_ORIGIN, TESLA_PROXY_SECRET.
 */
export const API_PROXY_PREFIX = '/api/v1/';

export interface ApiProxyConfig {
  origin: string | undefined;
  secret: string | undefined;
}

const CLIENT_IP = /^[0-9A-Fa-f:.]{2,45}$/;
const SECRET = /^[A-Za-z0-9_-]{32,128}$/;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Origine https de l'API, ou http sur la boucle locale (essais) ; jamais de chemin. */
function apiOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const secure =
      url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname));
    return secure && url.pathname === '/' && !url.search && !url.username ? url.origin : null;
  } catch {
    return null;
  }
}

function unavailable(path: string): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service momentanément indisponible. Réessayez dans quelques minutes.',
      path,
      timestamp: new Date().toISOString(),
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function proxyApiRequest(
  request: NextRequest,
  config: ApiProxyConfig = {
    origin: process.env.TESLA_API_ORIGIN,
    secret: process.env.TESLA_PROXY_SECRET,
  },
): NextResponse {
  const { pathname, search } = request.nextUrl;
  const origin = apiOrigin(config.origin);
  if (!origin || !config.secret || !SECRET.test(config.secret)) {
    console.error('Relais API : TESLA_API_ORIGIN ou TESLA_PROXY_SECRET absent ou invalide.');
    return unavailable(pathname);
  }

  const headers = new Headers(request.headers);
  // Host du domaine de l'API (jamais celui du web : Nginx choisirait un autre site du VPS).
  headers.delete('host');
  headers.set('x-tesla-proxy-secret', config.secret);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip && CLIENT_IP.test(ip)) headers.set('x-tesla-client-ip', ip);
  else headers.delete('x-tesla-client-ip');

  return NextResponse.rewrite(new URL(`${pathname}${search}`, origin), { request: { headers } });
}
