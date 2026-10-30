import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { effectivePermissions, type LeaderFunction, type Role } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  findActiveItem,
  hasPathwayNav,
  HOME_ROUTE,
  navigationFor,
  NAVIGATION,
  type NavUser,
  PATHWAY_BOTTOM_NAV,
  resolvePostLoginPath,
  safeInternalPath,
} from './navigation';

const APP_DIR = join(import.meta.dirname, '..', 'app');

/** Utilisateur tel que renvoyé par `/auth/me` (permissions calculées comme par l'API). */
const persona = (role: Role, leaderFunction: LeaderFunction | null = null): NavUser => ({
  permissions: effectivePermissions({ role, leaderFunction }),
});

const routier = persona('ROUTIER');
/** Membre de l'encadrement sans fonction désignée : aucune décision officielle. */
const encadrant = persona('ENCADREMENT');
const adjoint = persona('ENCADREMENT', 'ADJOINT');
const assistant = persona('ENCADREMENT', 'ASSISTANT');
const plein = persona('ENCADREMENT', 'PLEIN');
const admin = persona('ADMINISTRATEUR');
const ALL = { routier, encadrant, adjoint, assistant, plein, admin };

/** Page App Router correspondant au chemin, dans `(espaces)/` ou à la racine. */
function pageExists(href: string): boolean {
  return ['(espaces)', ''].some((group) => existsSync(join(APP_DIR, group, href, 'page.tsx')));
}

const hrefs = (user: NavUser) =>
  navigationFor(user).flatMap((group) => group.items.map((item) => item.href));

describe('application unique (D132)', () => {
  it('la même page d’arrivée pour tous, existante et accessible (pas de choix d’espace)', () => {
    expect(pageExists(HOME_ROUTE)).toBe(true);
    for (const user of Object.values(ALL)) {
      expect(canAccessPath(user, HOME_ROUTE)).toBe(true);
      expect(resolvePostLoginPath(user, null)).toBe(HOME_ROUTE);
    }
  });

  it('les anciens tableaux de bord par espace n’existent plus et sont redirigés', () => {
    for (const path of ['/routier', '/encadrement', '/mandats']) {
      expect(pageExists(path), path).toBe(false);
    }
    const config = readFileSync(join(APP_DIR, '..', '..', 'next.config.ts'), 'utf8');
    for (const [source, destination] of [
      ['/routier', '/accueil'],
      ['/encadrement', '/accueil'],
      ['/mandats', '/communaute'],
      ['/chef', '/accueil'],
      ['/responsable', '/accueil'],
    ]) {
      expect(config).toContain(`source: '${source}', destination: '${destination}'`);
    }
  });

  it('aucun libellé de menu ne reprend un rôle technique, un mandat ou une délégation', () => {
    const labels = NAVIGATION.flatMap((group) => [
      group.label,
      ...group.items.map((item) => item.label),
    ]);
    for (const label of labels) {
      expect(label).not.toMatch(/\b(ROUTIER|ENCADREMENT|ADMINISTRATEUR)\b/);
      expect(label).not.toMatch(/mandat|délégation|espace|rôle|\bchef/i);
    }
  });
});

describe('accès par chemin', () => {
  it('rédaction, correction et suivi : tout l’encadrement, quelle que soit sa fonction', () => {
    for (const path of [
      '/encadrement/modules',
      '/encadrement/modules/nouveau',
      '/encadrement/evaluations/nouvelle',
      '/encadrement/evaluations/papier',
      '/encadrement/corrections',
      '/administration/routiers',
      '/administration/validations',
    ]) {
      for (const user of [encadrant, adjoint, assistant, plein])
        expect(canAccessPath(user, path), path).toBe(true);
      expect(canAccessPath(routier, path), path).toBe(false);
      expect(canAccessPath(admin, path), path).toBe(false);
    }
  });

  it('réserve les décisions au responsable plein', () => {
    for (const path of [
      '/administration/modules-a-valider',
      '/administration/modules/abc/revision',
      '/administration/evaluations',
      '/administration/evaluations-a-valider/abc',
      '/administration/deblocages',
      '/administration/historique-publications',
    ]) {
      expect(canAccessPath(plein, path)).toBe(true);
      for (const user of [encadrant, adjoint, assistant, routier, admin])
        expect(canAccessPath(user, path)).toBe(false);
    }
  });

  it('la page de l’encadrement est ouverte à tout membre connecté', () => {
    for (const user of Object.values(ALL)) expect(canAccessPath(user, '/communaute')).toBe(true);
  });

  it('l’administrateur n’a aucun accès pédagogique', () => {
    for (const path of [
      '/encadrement/modules',
      '/administration/routiers',
      '/modules',
      '/progression',
    ])
      expect(canAccessPath(admin, path)).toBe(false);
  });

  it('distingue le préfixe exact (« evaluations » n’ouvre pas « evaluations-a-valider »)', () => {
    expect(canAccessPath(routier, '/evaluations/abc/passer')).toBe(true);
    expect(canAccessPath(routier, '/evaluations-x')).toBe(false);
  });

  it('réserve les écrans du parcours personnel à qui en suit un', () => {
    for (const path of ['/evaluations', '/mes-resultats', '/progression', '/mes-rattrapages']) {
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
    for (const path of ['/inconnu', '/', '/chef', '/responsable', '/routier', '/mandats']) {
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

  it('remplace une page non autorisée par l’accueil', () => {
    expect(resolvePostLoginPath(routier, '/administration/routiers')).toBe(HOME_ROUTE);
    expect(resolvePostLoginPath(encadrant, '/administration/deblocages')).toBe(HOME_ROUTE);
    expect(resolvePostLoginPath(plein, '/connexion')).toBe(HOME_ROUTE);
  });

  it('refuse les redirections externes', () => {
    for (const value of ['https://exemple.org', '//exemple.org', '/\\exemple.org', 'chef']) {
      expect(safeInternalPath(value)).toBeNull();
      expect(resolvePostLoginPath(encadrant, value)).toBe(HOME_ROUTE);
    }
  });
});

describe('navigation', () => {
  it.each(Object.entries(ALL))(
    '%s : chaque entrée pointe vers une page existante et autorisée',
    (_, user) => {
      for (const href of hrefs(user)) {
        expect(pageExists(href), href).toBe(true);
        expect(canAccessPath(user, href), href).toBe(true);
      }
    },
  );

  it('aucune entrée en double dans le menu unique', () => {
    const all = NAVIGATION.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(Object.entries(ALL))(
    '%s : l’accueil est la première entrée, toujours visible',
    (_, user) => {
      const [first] = navigationFor(user);
      expect(first?.items[0]?.href).toBe(HOME_ROUTE);
      expect(first?.collapsible).toBeFalsy();
    },
  );

  it('affiche seulement les fonctionnalités autorisées', () => {
    expect(hrefs(routier)).toContain('/progression');
    expect(hrefs(routier)).not.toContain('/administration/routiers');
    expect(hrefs(encadrant)).toContain('/administration/routiers');
    expect(hrefs(encadrant)).not.toContain('/progression');
    expect(hrefs(admin)).toEqual([HOME_ROUTE, '/communaute', '/administration/comptes']);
  });

  it('un même menu pour l’encadrement, enrichi des seules décisions du plein', () => {
    const labels = (user: NavUser) => navigationFor(user).map((group) => group.label);
    expect(labels(plein)).toContain('Contenus à approuver');
    expect(labels(adjoint)).not.toContain('Contenus à approuver');
    expect(hrefs(adjoint)).toEqual(hrefs(encadrant));
    expect(hrefs(assistant)).toEqual(hrefs(encadrant));
    expect(hrefs(encadrant).every((href) => hrefs(plein).includes(href))).toBe(true);
  });

  it('barre mobile : quatre entrées du parcours personnel, pour qui en suit un', () => {
    expect(PATHWAY_BOTTOM_NAV).toHaveLength(4);
    for (const item of PATHWAY_BOTTOM_NAV) expect(hrefs(routier)).toContain(item.href);
    expect(hasPathwayNav(routier)).toBe(true);
    expect(hasPathwayNav(plein)).toBe(false);
    expect(hasPathwayNav(admin)).toBe(false);
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

describe('comptes (D119)', () => {
  it('« Mon compte » est accessible à tout utilisateur connecté', () => {
    for (const user of Object.values(ALL)) expect(canAccessPath(user, '/compte')).toBe(true);
  });

  it('la gestion des comptes exige `account.read` (plein, administrateur)', () => {
    expect(canAccessPath(plein, '/administration/comptes')).toBe(true);
    expect(canAccessPath(admin, '/administration/comptes')).toBe(true);
    for (const user of [encadrant, adjoint, routier])
      expect(canAccessPath(user, '/administration/comptes')).toBe(false);
    expect(hrefs(admin)).toContain('/administration/comptes');
    expect(hrefs(encadrant)).not.toContain('/administration/comptes');
  });
});
