import { Logger } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

const logger = new Logger('HTTP');

/**
 * Journalise méthode, chemin, statut et durée. Ni corps ni chaîne de requête : les recherches
 * (noms de routiers, codes de tentative) sont des données personnelles.
 */
export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();
  response.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const path = request.originalUrl.split('?', 1)[0];
    logger.log(`${request.method} ${path} ${response.statusCode} ${durationMs}ms`);
  });
  next();
}
