import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Role } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  DEFAULT_ROUTES,
  findActiveItem,
  getDefaultRouteForUser,
  NAVIGATION,
  resolvePostLoginPath,
  ROUTIER_BOTTOM_NAV,
  safeInternalPath,
} from './navigation';

const ROLES: Role[] = ['ROUTIER', 'CHEF', 'RESPONSABLE'];
const APP_DIR = join(import.meta.dirname, '..', 'app');

/** Page App Router correspondant au chemin, dans `(espaces)/` ou à la racine. */
function pageExists(href: string): boolean {
  return ['(espaces)', ''].some((group) => existsSync(join(APP_DIR, group, href, 'page.tsx')));
}

describe('destination par défaut', () => {
  it('oriente chaque rôle vers son tableau de bord, sans écran de choix', () => {
    expect(getDefaultRouteForUser({ role: 'ROUTIER' })).toBe('/routier');
    expect(getDefaultRouteForUser({ role: 'CHEF' })).toBe('/chef');
    expect(getDefaultRouteForUser({ role: 'RESPONSABLE' })).toBe('/responsable');
  });

  it.each(ROLES)(
    'le tableau de bord de %s existe et lui est accessible (pas de boucle)',
    (role) => {
      expect(pageExists(DEFAULT_ROUTES[role])).toBe(true);
      expect(canAccessPath(role, DEFAULT_ROUTES[role])).toBe(true);
    },
  );
});

describe('accès par chemin', () => {
  it('donne au responsable les fonctions des chefs sans changer d’espace', () => {
    for (const path of [
      '/chef/modules',
      '/chef/modules/nouveau',
      '/chef/evaluations/nouvelle',
      '/chef/evaluations/papier',
      '/chef/corrections',
      '/administration/routiers',
      '/administration/validations',
    ]) {
      expect(canAccessPath('RESPONSABLE', path)).toBe(true);
      expect(canAccessPath('CHEF', path)).toBe(true);
    }
  });

  it('réserve les décisions au responsable', () => {
    for (const path of [
      '/responsable',
      '/administration/modules-a-valider',
      '/administration/modules/abc/revision',
      '/administration/evaluations',
      '/administration/evaluations-a-valider/abc',
      '/administration/deblocages',
      '/administration/historique-publications',
    ]) {
      expect(canAccessPath('RESPONSABLE', path)).toBe(true);
      expect(canAccessPath('CHEF', path)).toBe(false);
      expect(canAccessPath('ROUTIER', path)).toBe(false);
    }
  });

  it('distingue le préfixe exact (« evaluations » n’ouvre pas « evaluations-a-valider »)', () => {
    expect(canAccessPath('ROUTIER', '/evaluations/abc/passer')).toBe(true);
    expect(canAccessPath('ROUTIER', '/evaluations-x')).toBe(false);
  });

  it('refuse aux routiers les fiches et l’encadrement', () => {
    for (const path of ['/chef', '/chef/modules', '/administration/routiers', '/responsable']) {
      expect(canAccessPath('ROUTIER', path)).toBe(false);
    }
  });

  it('réserve les écrans personnels au routier', () => {
    for (const path of ['/routier', '/evaluations', '/mes-resultats', '/progression']) {
      expect(canAccessPath('ROUTIER', path)).toBe(true);
      expect(canAccessPath('CHEF', path)).toBe(false);
    }
  });

  it('renvoie le responsable vers son propre tableau de bord plutôt que celui des chefs', () => {
    expect(canAccessPath('RESPONSABLE', '/chef')).toBe(false);
    expect(canAccessPath('CHEF', '/chef')).toBe(true);
  });

  it('ouvre la bibliothèque à tous et ignore la chaîne de requête', () => {
    for (const role of ROLES) expect(canAccessPath(role, '/modules/m1?lecon=2')).toBe(true);
  });

  it('refuse un chemin sans règle', () => {
    expect(canAccessPath('RESPONSABLE', '/inconnu')).toBe(false);
    expect(canAccessPath('RESPONSABLE', '/')).toBe(false);
  });
});

describe('destination après connexion', () => {
  it('conserve une page demandée autorisée', () => {
    expect(resolvePostLoginPath({ role: 'CHEF' }, '/chef/corrections')).toBe('/chef/corrections');
    expect(resolvePostLoginPath({ role: 'RESPONSABLE' }, '/chef/modules?page=2')).toBe(
      '/chef/modules?page=2',
    );
  });

  it('remplace une page non autorisée par le tableau de bord du rôle', () => {
    expect(resolvePostLoginPath({ role: 'ROUTIER' }, '/administration/routiers')).toBe('/routier');
    expect(resolvePostLoginPath({ role: 'CHEF' }, '/administration/deblocages')).toBe('/chef');
    expect(resolvePostLoginPath({ role: 'RESPONSABLE' }, '/connexion')).toBe('/responsable');
    expect(resolvePostLoginPath({ role: 'RESPONSABLE' }, null)).toBe('/responsable');
  });

  it('refuse les redirections externes', () => {
    for (const value of ['https://exemple.org', '//exemple.org', '/\\exemple.org', 'chef']) {
      expect(safeInternalPath(value)).toBeNull();
      expect(resolvePostLoginPath({ role: 'CHEF' }, value)).toBe('/chef');
    }
  });
});

describe('navigation', () => {
  it.each(ROLES)('%s : chaque entrée pointe vers une page existante et autorisée', (role) => {
    for (const item of NAVIGATION[role].flatMap((group) => group.items)) {
      expect(pageExists(item.href), item.href).toBe(true);
      expect(canAccessPath(role, item.href), item.href).toBe(true);
    }
  });

  it.each(ROLES)('%s : aucune entrée en double', (role) => {
    const hrefs = NAVIGATION[role].flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(ROLES)('%s : le tableau de bord est la première entrée', (role) => {
    expect(NAVIGATION[role][0]?.items[0]?.href).toBe(DEFAULT_ROUTES[role]);
  });

  it('sépare la validation des contenus de celle des personnes (responsable)', () => {
    const labels = NAVIGATION.RESPONSABLE.map((group) => group.label);
    expect(labels).toContain('Validation des contenus');
    expect(labels).toContain('Décisions sur les routiers');
  });

  it('limite la barre mobile à quatre entrées du menu routier', () => {
    const routierHrefs = NAVIGATION.ROUTIER.flatMap((group) => group.items.map((i) => i.href));
    expect(ROUTIER_BOTTOM_NAV).toHaveLength(4);
    for (const item of ROUTIER_BOTTOM_NAV) expect(routierHrefs).toContain(item.href);
  });

  it('retient l’entrée la plus précise comme page active', () => {
    expect(findActiveItem('CHEF', '/chef/evaluations/papier/NT-2026-000001')?.href).toBe(
      '/chef/evaluations/papier',
    );
    expect(findActiveItem('CHEF', '/chef/evaluations/abc/modifier')?.href).toBe(
      '/chef/evaluations',
    );
    expect(findActiveItem('RESPONSABLE', '/administration/modules/abc/revision')?.href).toBe(
      '/administration/modules',
    );
  });
});
