import { Logger } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

const logger = new Logger('HTTP');

/** Journalise méthode, chemin, statut et durée. Aucun corps de requête n'est journalisé. */
export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();
  response.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
  });
  next();
}
