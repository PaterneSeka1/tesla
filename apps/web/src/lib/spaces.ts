import { type Role } from '@tesla/shared';
import { House, LayoutDashboard, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SpaceConfig {
  role: Role;
  title: string;
  nav: NavItem[];
}

/**
 * Espaces par rôle. Règle : aucune entrée de menu ne pointe vers un écran inexistant.
 * Ajouter une entrée uniquement lorsque la page correspondante est développée.
 */
export const SPACES = {
  routier: {
    role: 'ROUTIER',
    title: 'Espace routier',
    nav: [{ href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  chef: {
    role: 'CHEF',
    title: 'Espace chef',
    nav: [{ href: '/chef', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  responsable: {
    role: 'RESPONSABLE',
    title: 'Espace responsable pédagogique',
    nav: [{ href: '/responsable', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
} satisfies Record<string, SpaceConfig>;

export type SpaceKey = keyof typeof SPACES;

export const HOME_NAV_ITEM: NavItem = { href: '/', label: 'Accueil', icon: House };
