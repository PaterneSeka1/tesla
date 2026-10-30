import { SESSION_COOKIE_NAME } from '@tesla/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Contrôle optimiste sur la seule présence du cookie de session (sa validité et le rôle sont
 * vérifiés par l'API : `/auth/me` dans `SessionGate` et chaque route de données).
 * - `/` avec cookie : vers `/connexion`, qui oriente un utilisateur connecté vers son tableau de
 *   bord (pas d'écran de choix d'espace). `/connexion` n'est jamais redirigée ici : une session
 *   expirée (cookie encore présent) y affiche le formulaire, sans boucle.
 * - Page connectée sans cookie : vers `/connexion`, avec retour à la page demandée.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const { pathname, search } = request.nextUrl;

  if (pathname === '/') {
    return hasSession
      ? NextResponse.redirect(new URL('/connexion', request.url))
      : NextResponse.next();
  }
  if (hasSession) return NextResponse.next();
  const url = new URL('/connexion', request.url);
  url.searchParams.set('suivant', `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/',
    '/routier/:path*',
    '/encadrement/:path*',
    '/responsable/:path*',
    '/administration/:path*',
    '/modules/:path*',
    '/evaluations/:path*',
    '/mes-resultats/:path*',
    '/progression/:path*',
    '/mes-competences/:path*',
    '/mes-activites/:path*',
    '/appareil/:path*',
  ],
};
