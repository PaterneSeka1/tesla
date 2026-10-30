import { type Authority } from '@tesla/shared';

/**
 * Utilisateur authentifié à l'origine d'une action, avec ses habilitations effectives (rôle d'accès,
 * fonction d'encadrement en cours) calculées à chaque requête par la garde de session (D132).
 */
export interface Actor extends Authority {
  userId: string;
}
