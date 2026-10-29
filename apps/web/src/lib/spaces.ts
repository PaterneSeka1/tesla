import { type Role } from '@tesla/shared';
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePenLine,
  History,
  House,
  LayoutDashboard,
  Library,
  type LucideIcon,
  PenLine,
  Printer,
  Send,
  Trophy,
  Unlock,
  Users,
  UsersRound,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Entrée réservée à certains rôles (affichage seulement : l'API vérifie chaque accès). */
  roles?: readonly Role[];
}

export interface SpaceConfig {
  /** Rôles autorisés (vérifiés aussi par l'API pour chaque donnée). */
  roles: readonly Role[];
  title: string;
  nav: NavItem[];
}

const LIBRARY_ITEM: NavItem = { href: '/modules', label: 'Bibliothèque', icon: BookOpen };

/** Évaluations publiées et historique personnel (routier). */
const LEARNER_EVALUATION_NAV: NavItem[] = [
  { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
  { href: '/mes-resultats', label: 'Mes résultats', icon: Trophy },
];

const FOLLOW_UP_NAV: NavItem[] = [
  { href: '/administration/routiers', label: 'Routiers', icon: Users },
  { href: '/administration/equipes', label: 'Équipes', icon: UsersRound },
];

/** Approbation et publication : responsable uniquement. */
const REVIEW_NAV: NavItem[] = [
  {
    href: '/administration/modules-a-valider',
    label: 'Modules à valider',
    icon: FileCheck2,
    roles: ['RESPONSABLE'],
  },
  {
    href: '/administration/evaluations-a-valider',
    label: 'Résultats à examiner',
    icon: ClipboardCheck,
    roles: ['RESPONSABLE'],
  },
  {
    href: '/administration/evaluations',
    label: 'Questionnaires',
    icon: ClipboardList,
    roles: ['RESPONSABLE'],
  },
  {
    href: '/administration/deblocages',
    label: 'Déblocages',
    icon: Unlock,
    roles: ['RESPONSABLE'],
  },
  {
    href: '/administration/modules',
    label: 'Tous les modules',
    icon: Library,
    roles: ['RESPONSABLE'],
  },
  {
    href: '/administration/historique-publications',
    label: 'Historique',
    icon: History,
    roles: ['RESPONSABLE'],
  },
];

const EDITOR_NAV: NavItem[] = [
  { href: '/chef/modules', label: 'Mes modules', icon: FilePenLine },
  { href: '/chef/soumissions', label: 'Soumissions', icon: Send },
  { href: '/chef/evaluations', label: 'Évaluations', icon: ClipboardList },
  { href: '/chef/evaluations/papier', label: 'Évaluation papier', icon: Printer },
  { href: '/chef/corrections', label: 'Corrections', icon: PenLine },
];

const ADMIN_NAV: NavItem[] = [...REVIEW_NAV, ...FOLLOW_UP_NAV];

/**
 * Espaces par rôle. Règle : aucune entrée de menu ne pointe vers un écran inexistant.
 * Ajouter une entrée uniquement lorsque la page correspondante est développée.
 */
export const SPACES = {
  routier: {
    roles: ['ROUTIER'],
    title: 'Espace routier',
    nav: [
      { href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard },
      LIBRARY_ITEM,
      ...LEARNER_EVALUATION_NAV,
    ],
  },
  chef: {
    /** Le responsable peut aussi rédiger (règle : création et modification ouvertes au responsable). */
    roles: ['CHEF', 'RESPONSABLE'],
    title: 'Espace chef',
    nav: [
      { href: '/chef', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['CHEF'] },
      {
        href: '/responsable',
        label: 'Tableau de bord',
        icon: LayoutDashboard,
        roles: ['RESPONSABLE'],
      },
      ...EDITOR_NAV,
      ...REVIEW_NAV,
      LIBRARY_ITEM,
      ...FOLLOW_UP_NAV,
    ],
  },
  responsable: {
    roles: ['RESPONSABLE'],
    title: 'Espace responsable pédagogique',
    nav: [
      { href: '/responsable', label: 'Tableau de bord', icon: LayoutDashboard },
      ...REVIEW_NAV,
      { href: '/chef/modules', label: 'Rédaction', icon: FilePenLine },
      { href: '/chef/evaluations', label: 'Évaluations', icon: ClipboardList },
      { href: '/chef/corrections', label: 'Corrections', icon: PenLine },
      LIBRARY_ITEM,
      ...FOLLOW_UP_NAV,
    ],
  },
  administration: {
    roles: ['CHEF', 'RESPONSABLE'],
    title: 'Suivi et validation',
    nav: [
      { href: '/chef', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['CHEF'] },
      {
        href: '/responsable',
        label: 'Tableau de bord',
        icon: LayoutDashboard,
        roles: ['RESPONSABLE'],
      },
      ...ADMIN_NAV,
      { href: '/chef/modules', label: 'Mes modules', icon: FilePenLine, roles: ['CHEF'] },
      LIBRARY_ITEM,
    ],
  },
  evaluations: {
    roles: ['ROUTIER'],
    title: 'Mes évaluations',
    nav: [
      { href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard },
      LIBRARY_ITEM,
      ...LEARNER_EVALUATION_NAV,
    ],
  },
  bibliotheque: {
    roles: ['ROUTIER', 'CHEF', 'RESPONSABLE'],
    title: 'Bibliothèque des modules',
    nav: [
      LIBRARY_ITEM,
      { href: '/routier', label: 'Mon espace', icon: LayoutDashboard, roles: ['ROUTIER'] },
      { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck, roles: ['ROUTIER'] },
      { href: '/chef', label: 'Mon espace', icon: LayoutDashboard, roles: ['CHEF'] },
      { href: '/responsable', label: 'Mon espace', icon: LayoutDashboard, roles: ['RESPONSABLE'] },
    ],
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
