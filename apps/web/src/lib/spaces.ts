import { type Role } from '@tesla/shared';
import { House, LayoutDashboard, type LucideIcon, Users, UsersRound } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SpaceConfig {
  /** Rôles autorisés (vérifiés aussi par l'API pour chaque donnée). */
  roles: readonly Role[];
  title: string;
  nav: NavItem[];
}

const ADMIN_NAV: NavItem[] = [
  { href: '/administration/routiers', label: 'Routiers', icon: Users },
  { href: '/administration/equipes', label: 'Équipes', icon: UsersRound },
];

/**
 * Espaces par rôle. Règle : aucune entrée de menu ne pointe vers un écran inexistant.
 * Ajouter une entrée uniquement lorsque la page correspondante est développée.
 */
export const SPACES = {
  routier: {
    roles: ['ROUTIER'],
    title: 'Espace routier',
    nav: [{ href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  chef: {
    roles: ['CHEF'],
    title: 'Espace chef',
    nav: [{ href: '/chef', label: 'Tableau de bord', icon: LayoutDashboard }, ...ADMIN_NAV],
  },
  responsable: {
    roles: ['RESPONSABLE'],
    title: 'Espace responsable pédagogique',
    nav: [{ href: '/responsable', label: 'Tableau de bord', icon: LayoutDashboard }, ...ADMIN_NAV],
  },
  administration: {
    roles: ['CHEF', 'RESPONSABLE'],
    title: 'Suivi des routiers',
    nav: ADMIN_NAV,
  },
} satisfies Record<string, SpaceConfig>;

export type SpaceKey = keyof typeof SPACES;

export const HOME_NAV_ITEM: NavItem = { href: '/', label: 'Accueil', icon: House };

/** Espace d'arrivée après connexion. */
export const ROLE_HOME: Record<Role, string> = {
  ROUTIER: '/routier',
  CHEF: '/chef',
  RESPONSABLE: '/responsable',
};
