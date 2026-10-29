import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { type SessionUser } from '@tesla/shared';
import { type Request } from 'express';
import { type Actor } from '../../common/actor.js';

/** Requête après passage de la garde de session. */
export interface AuthenticatedRequest extends Request {
  actor?: Actor;
  sessionUser?: SessionUser;
}

export const IS_PUBLIC = 'isPublic';

/** Route accessible sans session (connexion, déconnexion, santé). Toutes les autres l'exigent. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Acteur authentifié, transmis aux services qui vérifient les permissions. */
export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): Actor => {
  const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().actor;
  if (!actor) throw new UnauthorizedException();
  return actor;
});
