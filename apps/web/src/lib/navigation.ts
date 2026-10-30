import { type Permission, type Role, type SessionUser } from '@tesla/shared';
import {
  BarChart3,
  BookOpen,
  BadgeCheck,
  Route,
  Undo2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePenLine,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Medal,
  PenLine,
  Printer,
  Send,
  ShieldCheck,
  Trophy,
  Unlock,
  Users,
  UsersRound,
} from 'lucide-react';

// Navigation et accès côté web : confort d'affichage uniquement. L'API reste l'autorité
// (session globale + `assertCan` dans chaque service ; matrice `PERMISSIONS` de @tesla/shared).
// Le rôle d'accès choisit l'espace ; les permissions effectives (fonction du mandat, délégations)
// filtrent les écrans de décision (D94).

/** Utilisateur tel que vu par la navigation : rôle d'accès et permissions effectives. */
export type NavUser = Pick<SessionUser, 'role' | 'permissions'>;

/** Tableau de bord d'arrivée de chaque rôle (après connexion, sur `/`, après un refus d'accès). */
export const DEFAULT_ROUTES = {
  ROUTIER: '/routier',
  ENCADREMENT: '/encadrement',
  ADMINISTRATEUR: '/mandats',
} as const satisfies Record<Role, string>;

export function getDefaultRouteForUser(user: Pick<SessionUser, 'role'>): string {
  return DEFAULT_ROUTES[user.role];
}

const ROUTIER: readonly Role[] = ['ROUTIER'];
const STAFF: readonly Role[] = ['ENCADREMENT'];
const LIBRARY_READERS: readonly Role[] = ['ROUTIER', 'ENCADREMENT'];

interface AccessRule {
  path: string;
  roles: readonly Role[];
  /** Permission effective exigée en plus du rôle (écrans de décision). */
  permission?: Permission;
  /** Règle limitée au chemin exact (sinon : le chemin et ses sous-chemins). */
  exact?: boolean;
}

/**
 * Accès par chemin ; la règle la plus précise l'emporte. Un seul espace d'encadrement
 * (`/encadrement`, `/administration`) : chaque écran de décision exige la permission API
 * correspondante, détenue par le responsable plein en exercice ou par délégation.
 */
const ACCESS_RULES: readonly AccessRule[] = [
  { path: '/modules', roles: LIBRARY_READERS },
  { path: '/routier', roles: ROUTIER },
  { path: '/evaluations', roles: ROUTIER },
  { path: '/mes-resultats', roles: ROUTIER },
  { path: '/progression', roles: ROUTIER },
  { path: '/mes-rattrapages', roles: ROUTIER },
  { path: '/mes-competences', roles: ROUTIER },
  { path: '/mes-activites', roles: ROUTIER },
  { path: '/appareil', roles: ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR'] },
  { path: '/encadrement', roles: STAFF },
  { path: '/mandats', roles: ['ENCADREMENT', 'ADMINISTRATEUR'], permission: 'mandate.read' },
  { path: '/administration', roles: STAFF },
  { path: '/administration/referentiel-age', roles: STAFF, permission: 'ageRules.read' },
  { path: '/administration/modules-a-valider', roles: STAFF, permission: 'module.review' },
  { path: '/administration/modules', roles: STAFF, permission: 'module.review' },
  { path: '/administration/historique-publications', roles: STAFF, permission: 'module.review' },
  { path: '/administration/evaluations', roles: STAFF, permission: 'evaluation.review' },
  { path: '/administration/evaluations-a-valider', roles: STAFF, permission: 'attempt.decide' },
  { path: '/administration/deblocages', roles: STAFF, permission: 'waiver.manage' },
];

function matches(rule: AccessRule, pathname: string): boolean {
  if (pathname === rule.path) return true;
  return !rule.exact && pathname.startsWith(`${rule.path}/`);
}

/** Règle applicable : exacte d'abord, puis le préfixe le plus long. */
function findRule(pathname: string): AccessRule | undefined {
  return ACCESS_RULES.filter((rule) => matches(rule, pathname)).sort(
    (a, b) => Number(b.exact ?? false) - Number(a.exact ?? false) || b.path.length - a.path.length,
  )[0];
}

export function userCan(user: Pick<SessionUser, 'permissions'>, permission: Permission): boolean {
  return (user.permissions as readonly string[]).includes(permission);
}

/** L'utilisateur peut-il afficher ce chemin ? Un chemin hors règles (accueil, connexion) est refusé. */
export function canAccessPath(user: NavUser, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  const rule = findRule(path);
  if (!rule?.roles.includes(user.role)) return false;
  return !rule.permission || userCan(user, rule.permission);
}

/** Chemin interne uniquement (évite une redirection ouverte vers un autre site). */
export function safeInternalPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : null;
}

/**
 * Destination après connexion : la page demandée si elle est sûre et autorisée,
 * sinon le tableau de bord du rôle (jamais d'écran de choix d'espace).
 */
export function resolvePostLoginPath(user: NavUser, requested: string | null | undefined): string {
  const path = safeInternalPath(requested);
  return path && canAccessPath(user, path) ? path : getDefaultRouteForUser(user);
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Entrée affichée seulement si la permission effective est détenue. */
  permission?: Permission;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
  /** Groupe secondaire replié par défaut (déplié s'il contient la page affichée). */
  collapsible?: boolean;
}

const LIBRARY: NavItem = { href: '/modules', label: 'Bibliothèque', icon: Library };

/**
 * Menu par rôle d'accès, groupé. Un seul menu pour tout l'encadrement : les entrées de décision
 * n'apparaissent qu'avec la permission correspondante (`navigationFor`). Règle : aucune entrée
 * vers un écran inexistant (vérifié par `navigation.test.ts`), aucune entrée en double.
 */
export const NAVIGATION: Record<Role, readonly NavGroup[]> = {
  ROUTIER: [
    {
      label: 'Mon parcours',
      items: [
        { href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard },
        { href: '/progression', label: 'Progression', icon: GraduationCap },
        { href: '/mes-rattrapages', label: 'Rattrapages', icon: Undo2 },
        { href: '/mes-competences', label: 'Compétences', icon: Medal },
        { href: '/mes-activites', label: 'Activités', icon: CalendarDays },
      ],
    },
    {
      label: 'Apprendre',
      items: [
        LIBRARY,
        { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
        { href: '/mes-resultats', label: 'Résultats', icon: Trophy },
      ],
    },
  ],
  ENCADREMENT: [
    {
      label: 'Pilotage',
      items: [
        { href: '/encadrement', label: 'Tableau de bord', icon: LayoutDashboard },
        { href: '/administration/statistiques', label: 'Statistiques', icon: BarChart3 },
        { href: '/administration/programme-annuel', label: 'Programme annuel', icon: CalendarDays },
        { href: '/mandats', label: 'Responsables', icon: BadgeCheck, permission: 'mandate.read' },
      ],
    },
    {
      // Validation des contenus : distincte de la validation des personnes.
      label: 'Validation des contenus',
      items: [
        {
          href: '/administration/modules-a-valider',
          label: 'Modules à approuver',
          icon: FileCheck2,
          permission: 'module.review',
        },
        {
          href: '/administration/evaluations',
          label: 'Questionnaires à approuver',
          icon: ClipboardCheck,
          permission: 'evaluation.review',
        },
      ],
    },
    {
      label: 'Décisions',
      items: [
        {
          href: '/administration/evaluations-a-valider',
          label: 'Résultats à examiner',
          icon: ShieldCheck,
          permission: 'attempt.decide',
        },
        { href: '/administration/validations', label: 'Acquis et propositions', icon: Medal },
        {
          href: '/administration/deblocages',
          label: 'Déblocages',
          icon: Unlock,
          permission: 'waiver.manage',
        },
      ],
    },
    {
      label: 'Communauté',
      items: [
        { href: '/administration/routiers', label: 'Routiers', icon: Users },
        { href: '/administration/equipes', label: 'Équipes', icon: UsersRound },
        { href: '/administration/activites', label: 'Activités', icon: ClipboardList },
        { href: '/administration/presences', label: 'Présences', icon: CalendarCheck },
      ],
    },
    {
      label: 'Rédaction et correction',
      collapsible: true,
      items: [
        { href: '/encadrement/modules', label: 'Modules', icon: FilePenLine },
        { href: '/encadrement/evaluations', label: 'Questionnaires', icon: ClipboardList },
        { href: '/encadrement/evaluations/papier', label: 'Évaluations papier', icon: Printer },
        { href: '/encadrement/corrections', label: 'Corrections', icon: PenLine },
        { href: '/encadrement/soumissions', label: 'Soumissions', icon: Send },
      ],
    },
    {
      label: 'Référentiels',
      collapsible: true,
      items: [
        {
          href: '/administration/modules',
          label: 'Tous les modules',
          icon: BookOpen,
          permission: 'module.review',
        },
        { href: '/administration/competences', label: 'Compétences', icon: GraduationCap },
        {
          href: '/administration/referentiel-age',
          label: 'Référentiel d’âge',
          icon: Route,
          permission: 'ageRules.read',
        },
        {
          href: '/administration/historique-publications',
          label: 'Publications',
          icon: History,
          permission: 'module.review',
        },
        LIBRARY,
      ],
    },
  ],
  ADMINISTRATEUR: [
    {
      label: 'Administration',
      items: [{ href: '/mandats', label: 'Responsables', icon: BadgeCheck }],
    },
  ],
};

/** Menu effectif : entrées du rôle autorisées par les permissions, groupes vides retirés. */
export function navigationFor(user: NavUser): NavGroup[] {
  return NAVIGATION[user.role]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || userCan(user, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Accès rapides de la barre inférieure mobile (routier uniquement : navigation peu dense). */
export const ROUTIER_BOTTOM_NAV: readonly NavItem[] = [
  { href: '/routier', label: 'Accueil', icon: LayoutDashboard },
  { href: '/modules', label: 'Modules', icon: BookOpen },
  { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
  { href: '/progression', label: 'Progression', icon: GraduationCap },
];

/** Entrée active : la correspondance la plus précise (« /encadrement/modules » plutôt que « /encadrement »). */
export function findActiveHref(hrefs: readonly string[], pathname: string): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Entrée de menu correspondant à la page affichée (titre de l'en-tête mobile). */
export function findActiveItem(user: NavUser, pathname: string): NavItem | undefined {
  const items = navigationFor(user).flatMap((group) => group.items);
  const href = findActiveHref(
    items.map((item) => item.href),
    pathname,
  );
  return items.find((item) => item.href === href);
}
