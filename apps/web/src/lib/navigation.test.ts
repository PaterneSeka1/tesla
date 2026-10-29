import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  effectivePermissions,
  type LeaderFunction,
  type Permission,
  type Role,
} from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  DEFAULT_ROUTES,
  findActiveItem,
  getDefaultRouteForUser,
  navigationFor,
  NAVIGATION,
  type NavUser,
  resolvePostLoginPath,
  ROUTIER_BOTTOM_NAV,
  safeInternalPath,
} from './navigation';

const APP_DIR = join(import.meta.dirname, '..', 'app');

/** Utilisateur tel que renvoyé par `/auth/me` (permissions calculées comme par l'API). */
const persona = (
  role: Role,
  leaderFunction: LeaderFunction | null = null,
  delegated: Permission[] = [],
): NavUser => ({ role, permissions: effectivePermissions({ role, leaderFunction, delegated }) });

const routier = persona('ROUTIER');
/** Membre de l'encadrement sans mandat (ou ancien « chef ») : aucune décision officielle. */
const encadrant = persona('ENCADREMENT');
const assistant = persona('ENCADREMENT', 'ASSISTANT');
const plein = persona('ENCADREMENT', 'PLEIN');
const delegataire = persona('ENCADREMENT', 'ADJOINT', ['module.review']);
const admin = persona('ADMINISTRATEUR');
const ALL = { routier, encadrant, assistant, plein, delegataire, admin };

/** Page App Router correspondant au chemin, dans `(espaces)/` ou à la racine. */
function pageExists(href: string): boolean {
  return ['(espaces)', ''].some((group) => existsSync(join(APP_DIR, group, href, 'page.tsx')));
}

describe('destination par défaut', () => {
  it('oriente chaque rôle vers son tableau de bord, sans écran de choix', () => {
    expect(getDefaultRouteForUser(routier)).toBe('/routier');
    expect(getDefaultRouteForUser(encadrant)).toBe('/encadrement');
    expect(getDefaultRouteForUser(plein)).toBe('/encadrement');
    expect(getDefaultRouteForUser(admin)).toBe('/mandats');
  });

  it.each(Object.entries(ALL))(
    'le tableau de bord de %s existe et lui est accessible (pas de boucle)',
    (_, user) => {
      expect(pageExists(DEFAULT_ROUTES[user.role])).toBe(true);
      expect(canAccessPath(user, DEFAULT_ROUTES[user.role])).toBe(true);
    },
  );
});

describe('accès par chemin', () => {
  it('un seul espace d’encadrement, identique pour tous ses membres', () => {
    for (const path of [
      '/encadrement',
      '/encadrement/modules',
      '/encadrement/modules/nouveau',
      '/encadrement/evaluations/nouvelle',
      '/encadrement/evaluations/papier',
      '/encadrement/corrections',
      '/administration/routiers',
      '/administration/validations',
      '/mandats',
    ]) {
      for (const user of [encadrant, assistant, plein])
        expect(canAccessPath(user, path)).toBe(true);
    }
  });

  it('réserve les décisions aux personnes habilitées (plein ou délégation)', () => {
    for (const path of [
      '/administration/modules-a-valider',
      '/administration/modules/abc/revision',
      '/administration/evaluations',
      '/administration/evaluations-a-valider/abc',
      '/administration/deblocages',
      '/administration/historique-publications',
    ]) {
      expect(canAccessPath(plein, path)).toBe(true);
      expect(canAccessPath(encadrant, path)).toBe(false);
      expect(canAccessPath(assistant, path)).toBe(false);
      expect(canAccessPath(routier, path)).toBe(false);
    }
  });

  it('une délégation n’ouvre que les écrans de la permission déléguée', () => {
    expect(canAccessPath(delegataire, '/administration/modules-a-valider')).toBe(true);
    expect(canAccessPath(delegataire, '/administration/deblocages')).toBe(false);
  });

  it('l’administration technique ne voit que les mandats', () => {
    expect(canAccessPath(admin, '/mandats')).toBe(true);
    for (const path of ['/encadrement', '/administration/routiers', '/modules', '/routier']) {
      expect(canAccessPath(admin, path)).toBe(false);
    }
  });

  it('distingue le préfixe exact (« evaluations » n’ouvre pas « evaluations-a-valider »)', () => {
    expect(canAccessPath(routier, '/evaluations/abc/passer')).toBe(true);
    expect(canAccessPath(routier, '/evaluations-x')).toBe(false);
  });

  it('refuse aux routiers les fiches et l’encadrement', () => {
    for (const path of [
      '/encadrement',
      '/encadrement/modules',
      '/administration/routiers',
      '/mandats',
    ]) {
      expect(canAccessPath(routier, path)).toBe(false);
    }
  });

  it('réserve les écrans personnels au routier', () => {
    for (const path of [
      '/routier',
      '/evaluations',
      '/mes-resultats',
      '/progression',
      '/mes-rattrapages',
    ]) {
      expect(canAccessPath(routier, path)).toBe(true);
      expect(canAccessPath(plein, path)).toBe(false);
    }
  });

  it('ouvre la bibliothèque aux routiers et à l’encadrement, et ignore la chaîne de requête', () => {
    for (const user of [routier, encadrant, plein]) {
      expect(canAccessPath(user, '/modules/m1?lecon=2')).toBe(true);
    }
  });

  it('refuse un chemin sans règle, y compris les anciennes URL redirigées', () => {
    for (const path of ['/inconnu', '/', '/chef', '/responsable']) {
      expect(canAccessPath(plein, path)).toBe(false);
    }
  });
});

describe('destination après connexion', () => {
  it('conserve une page demandée autorisée', () => {
    expect(resolvePostLoginPath(encadrant, '/encadrement/corrections')).toBe(
      '/encadrement/corrections',
    );
    expect(resolvePostLoginPath(plein, '/encadrement/modules?page=2')).toBe(
      '/encadrement/modules?page=2',
    );
  });

  it('remplace une page non autorisée par le tableau de bord du rôle', () => {
    expect(resolvePostLoginPath(routier, '/administration/routiers')).toBe('/routier');
    expect(resolvePostLoginPath(encadrant, '/administration/deblocages')).toBe('/encadrement');
    expect(resolvePostLoginPath(plein, '/connexion')).toBe('/encadrement');
    expect(resolvePostLoginPath(admin, null)).toBe('/mandats');
  });

  it('refuse les redirections externes', () => {
    for (const value of ['https://exemple.org', '//exemple.org', '/\\exemple.org', 'chef']) {
      expect(safeInternalPath(value)).toBeNull();
      expect(resolvePostLoginPath(encadrant, value)).toBe('/encadrement');
    }
  });
});

describe('navigation', () => {
  it.each(Object.entries(ALL))(
    '%s : chaque entrée pointe vers une page existante et autorisée',
    (_, user) => {
      for (const item of navigationFor(user).flatMap((group) => group.items)) {
        expect(pageExists(item.href), item.href).toBe(true);
        expect(canAccessPath(user, item.href), item.href).toBe(true);
      }
    },
  );

  it.each(Object.keys(NAVIGATION) as Role[])('%s : aucune entrée en double', (role) => {
    const hrefs = NAVIGATION[role].flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(Object.entries(ALL))('%s : le tableau de bord est la première entrée', (_, user) => {
    expect(navigationFor(user)[0]?.items[0]?.href).toBe(DEFAULT_ROUTES[user.role]);
  });

  it('un même menu pour l’encadrement, enrichi des seules décisions autorisées', () => {
    const labels = (user: NavUser) => navigationFor(user).map((group) => group.label);
    expect(labels(plein)).toContain('Validation des contenus');
    expect(labels(encadrant)).not.toContain('Validation des contenus');
    const hrefs = (user: NavUser) => navigationFor(user).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs(encadrant).every((href) => hrefs(plein).includes(href))).toBe(true);
    expect(hrefs(delegataire)).toContain('/administration/modules-a-valider');
    expect(hrefs(delegataire)).not.toContain('/administration/deblocages');
  });

  it.each(Object.entries(ALL))(
    'garde le tableau de bord de %s dans un groupe toujours visible',
    (_, user) => {
      const group = navigationFor(user).find((g) =>
        g.items.some((item) => item.href === DEFAULT_ROUTES[user.role]),
      );
      expect(group?.collapsible).toBeFalsy();
    },
  );

  it('limite la barre mobile à quatre entrées du menu routier', () => {
    const routierHrefs = NAVIGATION.ROUTIER.flatMap((group) => group.items.map((i) => i.href));
    expect(ROUTIER_BOTTOM_NAV).toHaveLength(4);
    for (const item of ROUTIER_BOTTOM_NAV) expect(routierHrefs).toContain(item.href);
  });

  it('retient l’entrée la plus précise comme page active', () => {
    expect(findActiveItem(encadrant, '/encadrement/evaluations/papier/NT-2026-000001')?.href).toBe(
      '/encadrement/evaluations/papier',
    );
    expect(findActiveItem(encadrant, '/encadrement/evaluations/abc/modifier')?.href).toBe(
      '/encadrement/evaluations',
    );
    expect(findActiveItem(plein, '/administration/modules/abc/revision')?.href).toBe(
      '/administration/modules',
    );
  });
});
