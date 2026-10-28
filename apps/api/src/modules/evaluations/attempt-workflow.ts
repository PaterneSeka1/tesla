import { ConflictException } from '@nestjs/common';
import { type AttemptStatus } from '@tesla/shared';

/**
 * Transitions autorisées d'une tentative. Aucune transition ne modifie la progression du routier :
 * VALIDEE/REFUSEE est la décision du responsable sur ce résultat, pas la validation officielle d'une étape.
 * - A_CORRIGER → A_CORRIGER : nouvelle saisie avant soumission (historisée).
 * - SOUMISE → A_CORRIGER : correction après soumission (motif obligatoire, historisée).
 * - VALIDEE/REFUSEE → A_CORRIGER : réouverture administrative par le responsable (motif obligatoire).
 */
export const ATTEMPT_TRANSITIONS: Record<AttemptStatus, readonly AttemptStatus[]> = {
  PREPAREE: ['EN_COURS', 'A_CORRIGER', 'ANNULEE'],
  EN_COURS: ['A_CORRIGER', 'ANNULEE'],
  A_CORRIGER: ['A_CORRIGER', 'SOUMISE', 'ANNULEE'],
  SOUMISE: ['A_CORRIGER', 'VALIDEE', 'REFUSEE', 'ANNULEE'],
  VALIDEE: ['A_CORRIGER'],
  REFUSEE: ['A_CORRIGER'],
  ANNULEE: [],
};

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AttemptStatus, to: AttemptStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictException({
      code: 'INVALID_ATTEMPT_TRANSITION',
      message: 'Cette action n’est pas possible dans l’état actuel de la tentative.',
    });
  }
}
