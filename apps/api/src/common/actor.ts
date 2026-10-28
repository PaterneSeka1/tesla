import { type Role } from '@tesla/shared';

/**
 * Utilisateur authentifié à l'origine d'une action. Fourni par la couche d'authentification
 * (phase 1) ; les services l'exigent dès maintenant pour vérifier les permissions côté serveur.
 */
export interface Actor {
  userId: string;
  role: Role;
}
