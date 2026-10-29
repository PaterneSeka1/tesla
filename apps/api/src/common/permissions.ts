import { ForbiddenException } from '@nestjs/common';
import { hasPermission, type Permission } from '@tesla/shared';
import { type Actor } from './actor.js';

// Matrice : `PERMISSIONS` de @tesla/shared (partagée avec le web pour l'affichage). L'API reste
// l'autorité : chaque service appelle `assertCan` avant toute lecture ou écriture protégée.
export { PERMISSIONS, type Permission } from '@tesla/shared';

export function can(actor: Actor, permission: Permission): boolean {
  return hasPermission(actor, permission);
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    });
  }
}
