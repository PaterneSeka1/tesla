import { type NextFunction, type Request, type Response } from 'express';

/**
 * En-têtes de sécurité de toutes les réponses de l'API (sans dépendance) :
 * - `no-store` : fiches, observations et résultats ne restent dans aucun cache HTTP (navigateur,
 *   proxy) ; le hors ligne passe par le coffre chiffré de l'application, jamais par ce cache ;
 * - pas d'interprétation de type, pas d'affichage en cadre, pas de référent transmis ;
 * - ressources lisibles par le même site seulement.
 * HSTS est posé par le proxy inverse (Nginx), qui termine TLS.
 */
export function securityHeaders(request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // Documentation Swagger (désactivée par défaut en production) : page HTML avec scripts.
  if (!request.path.startsWith('/api/docs')) {
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  next();
}
