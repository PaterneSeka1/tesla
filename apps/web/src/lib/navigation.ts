import { type Permission, type SessionUser } from '@tesla/shared';
import {
  BarChart3,
  BookOpen,
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
  KeyRound,
  LayoutDashboard,
  Library,
  Network,
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
// Une seule application (D132) : aucun espace par rôle, aucun choix d'espace. Menu, pages et
// tableau de bord dépendent des seules permissions effectives renvoyées par `/auth/me`.

/** Utilisateur tel que vu par la navigation : permissions effectives seulement. */
export type NavUser = Pick<SessionUser, 'permissions'>;

/** Page d'arrivée unique (après connexion, sur `/`, après un refus d'accès). */
export const HOME_ROUTE = '/accueil';

interface AccessRule {
  path: string;
  /** Au moins une de ces permissions effectives ; absent : tout utilisateur connecté. */
  anyOf?: readonly Permission[];
  /** Règle limitée au chemin exact (sinon : le chemin et ses sous-chemins). */
  exact?: boolean;
}

const OWN = ['progression.readOwn'] as const;

/** Accès par chemin ; la règle la plus précise l'emporte. Un chemin sans règle est refusé. */
const ACCESS_RULES: readonly AccessRule[] = [
  { path: HOME_ROUTE },
  { path: '/communaute' },
  { path: '/compte' },
  { path: '/appareil' },
  { path: '/modules', anyOf: ['module.read'] },
  { path: '/evaluations', anyOf: ['evaluation.take'] },
  { path: '/mes-resultats', anyOf: OWN },
  { path: '/progression', anyOf: OWN },
  { path: '/mes-rattrapages', anyOf: OWN },
  { path: '/mes-competences', anyOf: OWN },
  { path: '/mes-activites', anyOf: OWN },
  { path: '/encadrement', anyOf: ['module.write'] },
  { path: '/encadrement/evaluations', anyOf: ['evaluation.write'] },
  { path: '/encadrement/evaluations/papier', anyOf: ['attempt.preparePaper'] },
  { path: '/encadrement/corrections', anyOf: ['attempt.record'] },
  { path: '/administration', anyOf: ['scout.read'] },
  { path: '/administration/statistiques', anyOf: ['statistics.read'] },
  { path: '/administration/activites', anyOf: ['activity.read'] },
  { path: '/administration/presences', anyOf: ['attendance.record'] },
  { path: '/administration/competences', anyOf: ['competency.read'] },
  { path: '/administration/validations', anyOf: ['competency.read'] },
  { path: '/administration/referentiel-age', anyOf: ['ageRules.read'] },
  { path: '/administration/comptes', anyOf: ['account.read'] },
  { path: '/administration/modules-a-valider', anyOf: ['module.review'] },
  { path: '/administration/modules', anyOf: ['module.review'] },
  { path: '/administration/historique-publications', anyOf: ['module.review'] },
  { path: '/administration/evaluations', anyOf: ['evaluation.review'] },
  { path: '/administration/evaluations-a-valider', anyOf: ['attempt.decide'] },
  { path: '/administration/deblocages', anyOf: ['waiver.manage'] },
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
  if (!rule) return false;
  return !rule.anyOf || rule.anyOf.some((permission) => userCan(user, permission));
}

/** Chemin interne uniquement (évite une redirection ouverte vers un autre site). */
export function safeInternalPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : null;
}

/**
 * Destination après connexion : la page demandée si elle est sûre et autorisée, sinon l'accueil
 * (jamais d'écran de choix d'espace).
 */
export function resolvePostLoginPath(user: NavUser, requested: string | null | undefined): string {
  const path = safeInternalPath(requested);
  return path && canAccessPath(user, path) ? path : HOME_ROUTE;
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

/**
 * Menu unique, groupé par rubrique. Chaque entrée n'apparaît qu'avec sa permission (`navigationFor`) :
 * un routier voit son parcours et ses formations, l'encadrement le suivi, la communauté et les
 * contenus, le responsable plein en plus les décisions, l'administrateur l'administration.
 * Règle : aucune entrée vers un écran inexistant ou inaccessible (vérifié par `navigation.test.ts`).
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Accueil',
    items: [{ href: HOME_ROUTE, label: 'Accueil', icon: LayoutDashboard }],
  },
  {
    label: 'Mon parcours',
    items: [
      {
        href: '/progression',
        label: 'Progression',
        icon: GraduationCap,
        permission: 'progression.readOwn',
      },
      {
        href: '/mes-rattrapages',
        label: 'Rattrapages',
        icon: Undo2,
        permission: 'progression.readOwn',
      },
      {
        href: '/mes-competences',
        label: 'Compétences',
        icon: Medal,
        permission: 'progression.readOwn',
      },
      {
        href: '/mes-activites',
        label: 'Activités',
        icon: CalendarDays,
        permission: 'progression.readOwn',
      },
      {
        href: '/mes-resultats',
        label: 'Résultats',
        icon: Trophy,
        permission: 'progression.readOwn',
      },
    ],
  },
  {
    label: 'Formations',
    items: [
      { href: '/modules', label: 'Bibliothèque', icon: Library, permission: 'module.read' },
      {
        href: '/evaluations',
        label: 'Évaluations',
        icon: ClipboardCheck,
        permission: 'evaluation.take',
      },
    ],
  },
  {
    label: 'Suivi pédagogique',
    items: [
      {
        href: '/administration/statistiques',
        label: 'Statistiques',
        icon: BarChart3,
        permission: 'statistics.read',
      },
      {
        href: '/administration/programme-annuel',
        label: 'Programme annuel',
        icon: CalendarDays,
        permission: 'scout.read',
      },
      {
        href: '/administration/evaluations-a-valider',
        label: 'Résultats à examiner',
        icon: ShieldCheck,
        permission: 'attempt.decide',
      },
      {
        href: '/administration/validations',
        label: 'Acquis et propositions',
        icon: Medal,
        permission: 'competency.read',
      },
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
      { href: '/communaute', label: 'Encadrement', icon: Network },
      {
        href: '/administration/routiers',
        label: 'Routiers',
        icon: Users,
        permission: 'scout.read',
      },
      {
        href: '/administration/equipes',
        label: 'Équipes',
        icon: UsersRound,
        permission: 'team.read',
      },
      {
        href: '/administration/activites',
        label: 'Activités',
        icon: ClipboardList,
        permission: 'activity.read',
      },
      {
        href: '/administration/presences',
        label: 'Présences',
        icon: CalendarCheck,
        permission: 'attendance.record',
      },
    ],
  },
  {
    // Validation des contenus : distincte de la validation des personnes.
    label: 'Contenus à approuver',
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
    label: 'Rédaction et correction',
    collapsible: true,
    items: [
      {
        href: '/encadrement/modules',
        label: 'Modules',
        icon: FilePenLine,
        permission: 'module.write',
      },
      {
        href: '/encadrement/evaluations',
        label: 'Questionnaires',
        icon: ClipboardList,
        permission: 'evaluation.write',
      },
      {
        href: '/encadrement/evaluations/papier',
        label: 'Évaluations papier',
        icon: Printer,
        permission: 'attempt.preparePaper',
      },
      {
        href: '/encadrement/corrections',
        label: 'Corrections',
        icon: PenLine,
        permission: 'attempt.record',
      },
      {
        href: '/encadrement/soumissions',
        label: 'Soumissions',
        icon: Send,
        permission: 'module.write',
      },
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
      {
        href: '/administration/competences',
        label: 'Compétences',
        icon: GraduationCap,
        permission: 'competency.read',
      },
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
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        href: '/administration/comptes',
        label: 'Comptes',
        icon: KeyRound,
        permission: 'account.read',
      },
    ],
  },
];

/** Menu effectif : entrées autorisées par les permissions, groupes vides retirés. */
export function navigationFor(user: NavUser): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || userCan(user, item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Accès rapides de la barre inférieure mobile, pour qui suit un parcours personnel. */
export const PATHWAY_BOTTOM_NAV: readonly NavItem[] = [
  { href: HOME_ROUTE, label: 'Accueil', icon: LayoutDashboard },
  { href: '/modules', label: 'Modules', icon: BookOpen },
  { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
  { href: '/progression', label: 'Progression', icon: GraduationCap },
];

/** La barre inférieure mobile est réservée aux personnes qui suivent un parcours personnel. */
export function hasPathwayNav(user: NavUser): boolean {
  return userCan(user, 'progression.readOwn');
}

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
