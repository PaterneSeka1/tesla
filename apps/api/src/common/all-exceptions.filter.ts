import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody } from '@tesla/shared';
import { type Request, type Response } from 'express';

const DEFAULT_ERRORS: Record<number, [code: string, message: string]> = {
  400: ['BAD_REQUEST', 'Requête invalide.'],
  401: ['UNAUTHENTICATED', 'Authentification requise.'],
  403: ['FORBIDDEN', 'Accès refusé.'],
  404: ['NOT_FOUND', 'Ressource introuvable.'],
  409: ['CONFLICT', 'Conflit avec l’état actuel de la ressource.'],
  422: ['UNPROCESSABLE_ENTITY', 'Données non valides.'],
  429: ['TOO_MANY_REQUESTS', 'Trop de requêtes, veuillez réessayer plus tard.'],
  500: ['INTERNAL_ERROR', 'Une erreur interne est survenue.'],
};

/**
 * Format d'erreur homogène (voir ApiErrorBody dans @tesla/shared).
 * Pour un message spécifique, lever l'exception avec `{ code, message }` :
 *   throw new NotFoundException({ code: 'MODULE_NOT_FOUND', message: 'Module introuvable.' })
 * Sinon, un message générique en français est renvoyé (aucun détail interne exposé).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const [defaultCode, defaultMessage] =
      DEFAULT_ERRORS[statusCode] ?? DEFAULT_ERRORS[statusCode >= 500 ? 500 : 400]!;

    let code = defaultCode;
    let message = defaultMessage;
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'object' && 'code' in payload && 'message' in payload) {
        code = String(payload.code);
        message = String(payload.message);
      }
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode,
      code,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }
}
