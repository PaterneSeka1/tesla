import { SESSION_COOKIE_NAME } from '@tesla/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Redirection rapide vers la connexion si aucun cookie de session n'est présent.
 * Contrôle optimiste seulement : la validité de la session et le rôle sont vérifiés par l'API
 * (`/auth/me` dans `SessionGate`, et chaque route de données).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next();
  const url = new URL('/connexion', request.url);
  url.searchParams.set('suivant', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/routier/:path*',
    '/chef/:path*',
    '/responsable/:path*',
    '/administration/:path*',
    '/modules/:path*',
    '/progression/:path*',
    '/mes-competences/:path*',
    '/mes-activites/:path*',
  ],
};
