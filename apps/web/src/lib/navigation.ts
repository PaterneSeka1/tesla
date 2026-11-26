import { type Permission, type SessionUser } from '@tesla/shared';
import {
  BarChart3,
  BookOpen,
  NotebookPen,
  Route,
  Target,
  Undo2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Footprints,
  FileCheck2,
  FilePenLine,
  FolderTree,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Library,
  Network,
  type LucideIcon,
  Medal,
  PenLine,
  ScrollText,
  Printer,
  Send,
  ShieldCheck,
  Trophy,
  Unlock,
  UserRound,
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
  // Référentiel scout (D220) : lecture comme la bibliothèque ; gestion par les rédacteurs.
  { path: '/referentiel', anyOf: ['module.read'] },
  { path: '/evaluations', anyOf: ['evaluation.take'] },
  // Entraînement libre (D198) ; carnet personnel (D196).
  { path: '/defis', anyOf: ['practice.play'] },
  { path: '/carnet', anyOf: ['practice.own'] },
  // Routiers et apprenants adultes (D185) : distinct du parcours Route.
  { path: '/mes-resultats', anyOf: ['results.readOwn'] },
  { path: '/progression', anyOf: OWN },
  { path: '/mes-rattrapages', anyOf: OWN },
  { path: '/mes-competences', anyOf: OWN },
  { path: '/mes-activites', anyOf: OWN },
  { path: '/encadrement', anyOf: ['module.write'] },
  { path: '/encadrement/evaluations', anyOf: ['evaluation.write'] },
  { path: '/encadrement/referentiel', anyOf: ['module.write'] },
  { path: '/encadrement/evaluations/papier', anyOf: ['attempt.preparePaper'] },
  { path: '/encadrement/corrections', anyOf: ['attempt.record'] },
  { path: '/encadrement/distribution', anyOf: ['attempt.preparePaper'] },
  // Fiches routiers : encadrement et administrateur (gestion administrative, D173).
  { path: '/administration', anyOf: ['scout.read'] },
  { path: '/administration/equipes', anyOf: ['team.read'] },
  { path: '/administration/programme-annuel', anyOf: ['activity.read'] },
  { path: '/administration/statistiques', anyOf: ['statistics.read'] },
  { path: '/administration/parcours', anyOf: ['statistics.read'] },
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
  /** Entrée masquée si cette permission est détenue (page rangée dans une autre rubrique). */
  hiddenWith?: Permission;
  /** Intertitre affiché avant l'entrée dans le menu, pour structurer une rubrique longue. */
  section?: string;
}

export interface NavGroup {
  /** Rubrique : une seule entrée du menu, vers sa première page autorisée. */
  label: string;
  icon: LucideIcon;
  /** Pages de la rubrique, affichées sous l'entrée lorsque la rubrique est active. */
  items: readonly NavItem[];
}

/**
 * Menu unique en rubriques (au plus cinq pour un routier ou un membre de l'encadrement). Chaque page
 * n'apparaît qu'avec sa permission (`navigationFor`) ; une rubrique sans page autorisée disparaît.
 * Routier : Accueil, Cours, Évaluations, Mon parcours, Mon profil. Adulte (D185) : Accueil, Cours,
 * Évaluations, Mon parcours (Résultats seulement), Mon profil. Encadrement : Accueil, Routiers,
 * Cours, Évaluations, Mon profil. Administrateur : Accueil, Mon profil, Administration.
 * Règle : aucune entrée vers un écran inexistant ou inaccessible (vérifié par `navigation.test.ts`).
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Accueil',
    icon: LayoutDashboard,
    items: [{ href: HOME_ROUTE, label: 'Accueil', icon: LayoutDashboard }],
  },
  {
    label: 'Routiers',
    icon: Users,
    items: [
      {
        href: '/administration/routiers',
        label: 'Routiers',
        icon: Users,
        permission: 'scout.read',
      },
      {
        href: '/administration/parcours',
        label: 'Parcours des routiers',
        icon: Footprints,
        permission: 'statistics.read',
      },
      {
        href: '/administration/adultes',
        label: 'Adultes',
        icon: UserRound,
        permission: 'scout.read',
      },
      {
        href: '/administration/equipes',
        label: 'Équipes',
        icon: UsersRound,
        permission: 'team.read',
      },
      {
        href: '/administration/validations',
        label: 'Acquis et propositions',
        icon: Medal,
        permission: 'competency.read',
      },
      {
        href: '/administration/programme-annuel',
        label: 'Programme annuel',
        icon: CalendarDays,
        permission: 'activity.read',
        section: 'Organisation',
      },
      {
        href: '/administration/activites',
        label: 'Activités',
        icon: ClipboardList,
        permission: 'activity.read',
        section: 'Organisation',
      },
      {
        href: '/administration/presences',
        label: 'Présences',
        icon: CalendarCheck,
        permission: 'attendance.record',
        section: 'Organisation',
      },
      {
        href: '/administration/statistiques',
        label: 'Statistiques',
        icon: BarChart3,
        permission: 'statistics.read',
        section: 'Organisation',
      },
      {
        href: '/administration/competences',
        label: 'Compétences',
        icon: GraduationCap,
        permission: 'competency.read',
        section: 'Référentiels',
      },
      {
        href: '/administration/referentiel-age',
        label: 'Référentiel d’âge',
        icon: Route,
        permission: 'ageRules.read',
        section: 'Référentiels',
      },
    ],
  },
  {
    label: 'Cours',
    icon: BookOpen,
    items: [
      { href: '/modules', label: 'Bibliothèque', icon: Library, permission: 'module.read' },
      {
        href: '/referentiel',
        label: 'Référentiel scout',
        icon: ScrollText,
        permission: 'module.read',
      },
      {
        href: '/encadrement/modules',
        label: 'Rédaction',
        icon: FilePenLine,
        permission: 'module.write',
      },
      {
        href: '/encadrement/soumissions',
        label: 'Mes soumissions',
        icon: Send,
        permission: 'module.write',
      },
      {
        href: '/encadrement/referentiel',
        label: 'Rubriques du référentiel',
        icon: FolderTree,
        permission: 'module.write',
      },
      {
        href: '/administration/modules-a-valider',
        label: 'Cours à approuver',
        icon: FileCheck2,
        permission: 'module.review',
        section: 'Décisions',
      },
      {
        href: '/administration/modules',
        label: 'Tous les cours',
        icon: BookOpen,
        permission: 'module.review',
        section: 'Décisions',
      },
      {
        href: '/administration/historique-publications',
        label: 'Publications',
        icon: History,
        permission: 'module.review',
        section: 'Décisions',
      },
    ],
  },
  {
    // Entraînement libre (D198) : apprenants ; l'encadrement y accède en aperçu depuis les cours.
    label: 'Défis',
    icon: Target,
    items: [
      {
        href: '/defis',
        label: 'Défis',
        icon: Target,
        permission: 'practice.play',
        hiddenWith: 'module.write',
      },
    ],
  },
  {
    label: 'Évaluations',
    icon: ClipboardCheck,
    items: [
      {
        href: '/encadrement/evaluations',
        label: 'Questionnaires',
        icon: ClipboardList,
        permission: 'evaluation.write',
      },
      {
        href: '/encadrement/corrections',
        label: 'Copies',
        icon: PenLine,
        permission: 'attempt.record',
      },
      {
        href: '/encadrement/evaluations/papier',
        label: 'Évaluations papier',
        icon: Printer,
        permission: 'attempt.preparePaper',
      },
      {
        href: '/administration/evaluations-a-valider',
        label: 'Résultats à examiner',
        icon: ShieldCheck,
        permission: 'attempt.decide',
        section: 'Décisions',
      },
      {
        href: '/administration/evaluations',
        label: 'Questionnaires à approuver',
        icon: FileCheck2,
        permission: 'evaluation.review',
        section: 'Décisions',
      },
      {
        href: '/administration/deblocages',
        label: 'Déblocages',
        icon: Unlock,
        permission: 'waiver.manage',
        section: 'Décisions',
      },
    ],
  },
  {
    label: 'Mon parcours',
    icon: GraduationCap,
    items: [
      // Évaluations officielles des apprenants (distinctes des défis d'entraînement, D198).
      {
        href: '/evaluations',
        label: 'Évaluations',
        icon: ClipboardCheck,
        permission: 'evaluation.take',
      },
      {
        href: '/progression',
        label: 'Progression',
        icon: GraduationCap,
        permission: 'progression.readOwn',
      },
      {
        href: '/carnet',
        label: 'Carnet',
        icon: NotebookPen,
        permission: 'practice.own',
      },
      {
        href: '/mes-rattrapages',
        label: 'Rattrapages',
        icon: Undo2,
        permission: 'progression.readOwn',
      },
      {
        href: '/mes-resultats',
        label: 'Résultats',
        icon: Trophy,
        permission: 'results.readOwn',
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
    ],
  },
  {
    label: 'Mon profil',
    icon: UserRound,
    items: [
      { href: '/compte', label: 'Mon profil', icon: UserRound },
      // Pour l'administrateur, la page est rangée dans « Administration ».
      { href: '/communaute', label: 'Encadrement', icon: Network, hiddenWith: 'leadership.manage' },
    ],
  },
  {
    // Rubrique discrète : gestion des comptes et désignation de l'encadrement (D142).
    label: 'Administration',
    icon: KeyRound,
    items: [
      {
        href: '/administration/comptes',
        label: 'Comptes',
        icon: KeyRound,
        permission: 'account.read',
      },
      {
        href: '/communaute',
        label: 'Encadrement',
        icon: Network,
        permission: 'leadership.manage',
      },
    ],
  },
];

/** Menu effectif : entrées autorisées par les permissions, groupes vides retirés. */
export function navigationFor(user: NavUser): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.permission || userCan(user, item.permission)) &&
        !(item.hiddenWith && userCan(user, item.hiddenWith)),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Onglet de la barre inférieure : une destination et la rubrique du menu qu'il représente. */
export interface BottomTab extends NavItem {
  /** Rubrique de `NAVIGATION` : l'onglet est actif sur toutes les pages de cette rubrique. */
  group: string;
}

/**
 * Barre inférieure mobile (D182, D198) : trois ou quatre destinations quotidiennes déduites des
 * permissions, puis « Plus » (toujours en dernière position, géré par l'interface). Ordre stable,
 * jamais de rôle affiché ; une seule barre, même pour une personne cumulant plusieurs
 * responsabilités.
 * - parcours personnel : Accueil, Cours (bibliothèque), Défis, Parcours ;
 * - apprenant adulte (D185) : Accueil, Cours, Défis, Évaluations ;
 * - encadrement : Accueil, Routiers, Cours (gestion pédagogique) ;
 * - administrateur : Accueil, Routiers (fiches, D173), Comptes.
 */
export function bottomTabsFor(user: NavUser): BottomTab[] {
  const tabs: BottomTab[] = [
    { href: HOME_ROUTE, label: 'Accueil', icon: LayoutDashboard, group: 'Accueil' },
  ];
  if (userCan(user, 'progression.readOwn')) {
    if (userCan(user, 'module.read'))
      tabs.push({ href: '/modules', label: 'Cours', icon: BookOpen, group: 'Cours' });
    if (userCan(user, 'practice.own'))
      tabs.push({ href: '/defis', label: 'Défis', icon: Target, group: 'Défis' });
    tabs.push({
      href: '/progression',
      label: 'Parcours',
      icon: GraduationCap,
      group: 'Mon parcours',
    });
  } else {
    if (userCan(user, 'scout.read'))
      tabs.push({
        href: '/administration/routiers',
        label: 'Routiers',
        icon: Users,
        group: 'Routiers',
      });
    if (userCan(user, 'module.write'))
      tabs.push({ href: '/encadrement/modules', label: 'Cours', icon: BookOpen, group: 'Cours' });
    else if (userCan(user, 'module.read'))
      tabs.push({ href: '/modules', label: 'Cours', icon: BookOpen, group: 'Cours' });
    // Apprenant adulte : les défis comme pour un routier.
    if (userCan(user, 'practice.own') && !userCan(user, 'module.write'))
      tabs.push({ href: '/defis', label: 'Défis', icon: Target, group: 'Défis' });
    // Apprenant adulte (D185) : pas de parcours Route, les évaluations en onglet.
    if (userCan(user, 'evaluation.take'))
      tabs.push({
        href: '/evaluations',
        label: 'Évaluations',
        icon: ClipboardCheck,
        group: 'Mon parcours',
      });
    else if (userCan(user, 'account.read'))
      tabs.push({
        href: '/administration/comptes',
        label: 'Comptes',
        icon: KeyRound,
        group: 'Administration',
      });
  }
  // Apprenants : au plus quatre destinations et « Plus », cinq en tout (cahier § 23) ;
  // encadrement et administration : trois, inchangé (D182).
  return tabs.slice(0, userCan(user, 'practice.own') ? 4 : 3);
}

/**
 * Onglet actif : celui de la rubrique de la page affichée ; `null` = « Plus » (page d'une autre
 * rubrique). Une page hors menu (fiche, leçon…) relève de la rubrique de son chemin parent.
 */
export function activeBottomTab(user: NavUser, pathname: string): BottomTab | null {
  const tabs = bottomTabsFor(user);
  const group = findActiveGroup(navigationFor(user), pathname);
  if (group) {
    const tab = tabs.find((item) => item.group === group.label);
    // La rubrique « Administration » d'un administrateur n'est un onglet que pour sa page Comptes.
    if (tab && (tab.group !== 'Administration' || pathname.startsWith(tab.href))) return tab;
    return null;
  }
  return tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)) ?? null;
}

/** Contenu du menu « Plus » : toutes les rubriques autorisées, sans les destinations déjà en onglet. */
export function moreNavigationFor(user: NavUser): NavGroup[] {
  const tabHrefs = new Set(bottomTabsFor(user).map((tab) => tab.href));
  return navigationFor(user)
    .map((group) => ({ ...group, items: group.items.filter((item) => !tabHrefs.has(item.href)) }))
    .filter((group) => group.items.length > 0);
}

/** Entrée active : la correspondance la plus précise (« /encadrement/modules » plutôt que « /encadrement »). */
export function findActiveHref(hrefs: readonly string[], pathname: string): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Rubrique contenant la page affichée (entrée mise en évidence, sous-pages dépliées). */
export function findActiveGroup(
  groups: readonly NavGroup[],
  pathname: string,
): NavGroup | undefined {
  const href = findActiveHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  );
  return href ? groups.find((group) => group.items.some((item) => item.href === href)) : undefined;
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
