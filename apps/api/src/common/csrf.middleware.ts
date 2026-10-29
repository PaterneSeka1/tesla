import { CSRF_HEADER, CSRF_HEADER_VALUE, type ApiErrorBody } from '@tesla/shared';
import { type NextFunction, type Request, type Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF des sessions par cookie (en complément de SameSite=Lax) :
 * toute requête modifiant des données doit porter l'en-tête `x-tesla-csrf: 1` (impossible à
 * envoyer depuis un site tiers sans pré-vol CORS autorisé) et, si le navigateur fournit l'en-tête
 * `Origin`, celui-ci doit figurer parmi les origines autorisées.
 */
export function csrfProtection(allowedOrigins: readonly string[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(request.method)) return next();
    const origin = request.headers.origin;
    const originOk = origin === undefined || allowedOrigins.includes(origin);
    if (originOk && request.headers[CSRF_HEADER] === CSRF_HEADER_VALUE) return next();

    const body: ApiErrorBody = {
      statusCode: 403,
      code: 'CSRF_REJECTED',
      message: 'Requête refusée : origine non autorisée ou en-tête de sécurité manquant.',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(403).json(body);
  };
}
