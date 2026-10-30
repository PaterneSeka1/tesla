import { createHash } from 'node:crypto';
import {
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { OPERATION_ERROR_CODES, OPERATION_ID_HEADER } from '@tesla/shared';
import { type Response } from 'express';
import { from, type Observable, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { z } from 'zod';
import { type Prisma } from '../generated/prisma/client.js';
import { type AuthenticatedRequest } from '../modules/auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUniqueViolation } from './prisma-errors.js';

/**
 * Au-delà de ce délai, une opération restée « en cours » (arrêt du serveur entre l'effet et
 * l'enregistrement de la réponse) n'est plus rejouée automatiquement : un humain vérifie.
 */
export const STALE_OPERATION_MS = 2 * 60_000;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const operationIdSchema = z.uuid();

export function bodyHash(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? null))
    .digest('hex');
}

/**
 * Idempotence des écritures rejouées par la file de synchronisation (D110). Ne s'applique qu'aux
 * requêtes authentifiées portant `x-tesla-operation-id` : sans cet en-tête, rien ne change.
 * 1. réservation de l'identifiant (clé primaire, compte, méthode, chemin, empreinte du corps) ;
 * 2. exécution normale (permissions et règles métier inchangées) ;
 * 3. réponse enregistrée ; un second envoi identique la reçoit sans nouvel effet.
 * Une erreur libère la réservation : l'écriture métier a été annulée par sa transaction.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers[OPERATION_ID_HEADER];
    if (header === undefined || !WRITE_METHODS.has(request.method) || !request.actor) {
      return next.handle();
    }
    const parsed = operationIdSchema.safeParse(header);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_OPERATION_ID',
        message: 'Identifiant d’opération invalide.',
      });
    }
    const id = parsed.data;
    const response = context.switchToHttp().getResponse<Response>();
    const claim = {
      id,
      userId: request.actor.userId,
      method: request.method,
      path: request.originalUrl.split('?')[0]!,
      bodyHash: bodyHash(request.body),
    };
    return from(this.reserve(claim)).pipe(
      mergeMap((replay) => {
        if (replay) {
          response.status(replay.status);
          return of(replay.body);
        }
        return next.handle().pipe(
          mergeMap((body: unknown) =>
            from(
              this.prisma.clientOperation.update({
                where: { id },
                data: {
                  responseStatus: response.statusCode,
                  responseBody: (body ?? null) as Prisma.InputJsonValue,
                  completedAt: new Date(),
                },
              }),
            ).pipe(mergeMap(() => of(body))),
          ),
          catchError((error: unknown) =>
            from(this.prisma.clientOperation.delete({ where: { id } }).catch(() => null)).pipe(
              mergeMap(() => {
                throw error;
              }),
            ),
          ),
        );
      }),
    );
  }

  /** `null` : opération nouvelle, réservée. Sinon : réponse déjà enregistrée à renvoyer. */
  private async reserve(claim: {
    id: string;
    userId: string;
    method: string;
    path: string;
    bodyHash: string;
  }): Promise<{ status: number; body: unknown } | null> {
    try {
      await this.prisma.clientOperation.create({ data: claim });
      return null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const existing = await this.prisma.clientOperation.findUnique({ where: { id: claim.id } });
    if (
      !existing ||
      existing.userId !== claim.userId ||
      existing.method !== claim.method ||
      existing.path !== claim.path ||
      existing.bodyHash !== claim.bodyHash
    ) {
      throw new ConflictException({
        code: OPERATION_ERROR_CODES.reused,
        message: 'Cette opération a déjà été reçue avec un autre contenu.',
      });
    }
    if (existing.responseStatus !== null) {
      return { status: existing.responseStatus, body: existing.responseBody };
    }
    if (Date.now() - existing.createdAt.getTime() < STALE_OPERATION_MS) {
      throw new ConflictException({
        code: OPERATION_ERROR_CODES.inProgress,
        message: 'Cette opération est déjà en cours de traitement. Réessayez dans un instant.',
      });
    }
    throw new ConflictException({
      code: OPERATION_ERROR_CODES.unconfirmed,
      message:
        'La réception de cette opération n’a pas pu être confirmée. Vérifiez si la modification est déjà enregistrée avant de la refaire.',
    });
  }
}
