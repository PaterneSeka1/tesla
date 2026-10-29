import { type Authority } from '@tesla/shared';

/**
 * Utilisateur authentifié à l'origine d'une action, avec ses habilitations effectives (rôle d'accès,
 * fonction du mandat en vigueur, délégations actives) calculées à chaque requête par la garde de
 * session : aucune permission ne dépend d'une tâche planifiée (D94).
 */
export interface Actor extends Authority {
  userId: string;
}
