import { type Role, type SessionUser } from '@tesla/shared';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CloudDownload,
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
// (session globale + `assertCan` dans chaque service, apps/api/src/common/permissions.ts).

const ALL: readonly Role[] = ['ROUTIER', 'CHEF', 'RESPONSABLE'];
const STAFF: readonly Role[] = ['CHEF', 'RESPONSABLE'];
const ROUTIER: readonly Role[] = ['ROUTIER'];
const RESPONSABLE: readonly Role[] = ['RESPONSABLE'];

/** Tableau de bord d'arrivée de chaque rôle (après connexion, sur `/`, après un refus d'accès). */
export const DEFAULT_ROUTES = {
  ROUTIER: '/routier',
  CHEF: '/chef',
  RESPONSABLE: '/responsable',
} as const satisfies Record<Role, string>;

export function getDefaultRouteForUser(user: Pick<SessionUser, 'role'>): string {
  return DEFAULT_ROUTES[user.role];
}

interface AccessRule {
  path: string;
  roles: readonly Role[];
  /** Règle limitée au chemin exact (sinon : le chemin et ses sous-chemins). */
  exact?: boolean;
}

/**
 * Rôles autorisés par chemin ; la règle la plus précise l'emporte. Le responsable dispose de
 * toutes les permissions des chefs (matrice API) : il accède aux écrans de rédaction et de suivi
 * sans changer d'espace ni de compte. Les écrans `/administration/*` réservés au responsable
 * correspondent aux permissions API `module.review`, `evaluation.review`, `attempt.decide` et
 * `waiver.manage`.
 */
const ACCESS_RULES: readonly AccessRule[] = [
  { path: '/modules', roles: ALL },
  { path: '/routier', roles: ROUTIER },
  { path: '/evaluations', roles: ROUTIER },
  { path: '/mes-resultats', roles: ROUTIER },
  { path: '/progression', roles: ROUTIER },
  { path: '/mes-competences', roles: ROUTIER },
  { path: '/mes-activites', roles: ROUTIER },
  { path: '/hors-ligne', roles: ROUTIER },
  { path: '/telechargements', roles: ROUTIER },
  { path: '/synchronisation', roles: ROUTIER },
  { path: '/chef', roles: STAFF },
  // Tableau de bord des chefs : le responsable dispose du sien, plus complet.
  { path: '/chef', roles: ['CHEF'], exact: true },
  { path: '/responsable', roles: RESPONSABLE },
  { path: '/administration', roles: STAFF },
  { path: '/administration/modules-a-valider', roles: RESPONSABLE },
  { path: '/administration/modules', roles: RESPONSABLE },
  { path: '/administration/historique-publications', roles: RESPONSABLE },
  { path: '/administration/evaluations', roles: RESPONSABLE },
  { path: '/administration/evaluations-a-valider', roles: RESPONSABLE },
  { path: '/administration/deblocages', roles: RESPONSABLE },
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

/** Le rôle peut-il afficher ce chemin ? Un chemin hors règles (accueil, connexion) est refusé. */
export function canAccessPath(role: Role, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  return findRule(path)?.roles.includes(role) ?? false;
}

/** Chemin interne uniquement (évite une redirection ouverte vers un autre site). */
export function safeInternalPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : null;
}

/**
 * Destination après connexion : la page demandée si elle est sûre et autorisée pour le rôle,
 * sinon le tableau de bord du rôle (jamais d'écran de choix d'espace).
 */
export function resolvePostLoginPath(
  user: Pick<SessionUser, 'role'>,
  requested: string | null | undefined,
): string {
  const path = safeInternalPath(requested);
  return path && canAccessPath(user.role, path) ? path : getDefaultRouteForUser(user);
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

const LIBRARY: NavItem = { href: '/modules', label: 'Bibliothèque', icon: Library };
const STATISTICS: NavItem = {
  href: '/administration/statistiques',
  label: 'Statistiques',
  icon: BarChart3,
};
const PROGRAMME: NavItem = {
  href: '/administration/programme-annuel',
  label: 'Programme annuel',
  icon: CalendarDays,
};
const COMMUNITY: NavGroup = {
  label: 'Communauté',
  items: [
    { href: '/administration/routiers', label: 'Routiers', icon: Users },
    { href: '/administration/equipes', label: 'Équipes', icon: UsersRound },
    { href: '/administration/activites', label: 'Activités', icon: ClipboardList },
    { href: '/administration/presences', label: 'Présences', icon: CalendarCheck },
  ],
};
const WRITING: readonly NavItem[] = [
  { href: '/chef/modules', label: 'Rédaction des modules', icon: FilePenLine },
  { href: '/chef/evaluations', label: 'Questionnaires', icon: ClipboardList },
  { href: '/chef/evaluations/papier', label: 'Évaluations papier', icon: Printer },
  { href: '/chef/corrections', label: 'Corrections', icon: PenLine },
];

/**
 * Navigation unique par rôle, groupée. Règle : aucune entrée vers un écran inexistant
 * (vérifié par `navigation.test.ts`), aucune entrée en double.
 */
export const NAVIGATION: Record<Role, readonly NavGroup[]> = {
  ROUTIER: [
    {
      label: 'Mon parcours',
      items: [
        { href: '/routier', label: 'Tableau de bord', icon: LayoutDashboard },
        { href: '/progression', label: 'Ma progression', icon: GraduationCap },
        { href: '/mes-competences', label: 'Mes compétences', icon: Medal },
        { href: '/mes-activites', label: 'Mes activités', icon: CalendarDays },
      ],
    },
    {
      label: 'Apprendre',
      items: [
        { href: '/modules', label: 'Modules', icon: BookOpen },
        { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
        { href: '/mes-resultats', label: 'Mes résultats', icon: Trophy },
        { href: '/hors-ligne', label: 'Hors ligne', icon: CloudDownload },
      ],
    },
  ],
  CHEF: [
    {
      label: 'Pilotage',
      items: [{ href: '/chef', label: 'Tableau de bord', icon: LayoutDashboard }, STATISTICS],
    },
    {
      label: 'Pédagogie',
      items: [
        ...WRITING,
        { href: '/chef/soumissions', label: 'Mes soumissions', icon: Send },
        LIBRARY,
      ],
    },
    {
      label: 'Suivi des routiers',
      items: [
        ...COMMUNITY.items,
        PROGRAMME,
        { href: '/administration/validations', label: 'Propositions de validation', icon: Medal },
      ],
    },
  ],
  RESPONSABLE: [
    {
      label: 'Pilotage',
      items: [
        { href: '/responsable', label: 'Tableau de bord', icon: LayoutDashboard },
        STATISTICS,
        PROGRAMME,
      ],
    },
    COMMUNITY,
    {
      label: 'Pédagogie',
      items: [
        ...WRITING,
        { href: '/administration/modules', label: 'Tous les modules', icon: Library },
        { href: '/administration/competences', label: 'Compétences', icon: GraduationCap },
        LIBRARY,
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
        },
        {
          href: '/administration/evaluations',
          label: 'Questionnaires à approuver',
          icon: ClipboardCheck,
        },
        { href: '/administration/historique-publications', label: 'Publications', icon: History },
      ],
    },
    {
      label: 'Décisions sur les routiers',
      items: [
        {
          href: '/administration/evaluations-a-valider',
          label: 'Résultats à examiner',
          icon: ShieldCheck,
        },
        { href: '/administration/validations', label: 'Acquis à valider', icon: Medal },
        { href: '/administration/deblocages', label: 'Déblocages', icon: Unlock },
      ],
    },
  ],
};

/** Accès rapides de la barre inférieure mobile (routier uniquement : navigation peu dense). */
export const ROUTIER_BOTTOM_NAV: readonly NavItem[] = [
  { href: '/routier', label: 'Accueil', icon: LayoutDashboard },
  { href: '/modules', label: 'Modules', icon: BookOpen },
  { href: '/evaluations', label: 'Évaluations', icon: ClipboardCheck },
  { href: '/progression', label: 'Progression', icon: GraduationCap },
];

/** Entrée active : la correspondance la plus précise (« /chef/modules » plutôt que « /chef »). */
export function findActiveHref(hrefs: readonly string[], pathname: string): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Entrée de menu correspondant à la page affichée (titre de l'en-tête mobile). */
export function findActiveItem(role: Role, pathname: string): NavItem | undefined {
  const items = NAVIGATION[role].flatMap((group) => group.items);
  const href = findActiveHref(
    items.map((item) => item.href),
    pathname,
  );
  return items.find((item) => item.href === href);
}
