import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { effectivePermissions, type LeaderFunction, type Role } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  findActiveGroup,
  findActiveItem,
  activeBottomTab,
  bottomTabsFor,
  HOME_ROUTE,
  moreNavigationFor,
  navigationFor,
  NAVIGATION,
  type NavUser,
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
/** Apprenant adulte (D185) : cours, évaluations et résultats, rien de la Route. */
const adulte = persona('ADULTE');
const ALL = { routier, adulte, encadrant, adjoint, assistant, plein, admin };

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
      '/encadrement/corrections/NT-2027-000001',
      '/encadrement/distribution/bases-du-scoutisme',
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
      '/administration/equipes',
      '/administration/programme-annuel',
      '/modules',
      '/progression',
    ])
      expect(canAccessPath(admin, path)).toBe(false);
  });

  it('fiches routiers : tout l’encadrement et l’administrateur (gestion administrative, D173)', () => {
    for (const user of [encadrant, adjoint, assistant, plein, admin]) {
      expect(canAccessPath(user, '/administration/routiers')).toBe(true);
    }
    expect(canAccessPath(routier, '/administration/routiers')).toBe(false);
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

  it.each(Object.entries(ALL))('%s : aucune entrée en double dans le menu', (_, user) => {
    expect(new Set(hrefs(user)).size).toBe(hrefs(user).length);
  });

  it('administrateur : fiches routiers, comptes et encadrement, rien de pédagogique (D142, D173)', () => {
    const groups = navigationFor(admin);
    expect(groups.map((group) => [group.label, group.items.map((item) => item.href)])).toEqual([
      ['Accueil', [HOME_ROUTE]],
      ['Routiers', ['/administration/routiers', '/administration/adultes']],
      ['Mon profil', ['/compte']],
      ['Administration', ['/administration/comptes', '/communaute']],
    ]);
  });

  it.each(Object.entries(ALL))('%s : l’accueil est la première rubrique', (_, user) => {
    const [first] = navigationFor(user);
    expect(first?.items[0]?.href).toBe(HOME_ROUTE);
  });

  it('cinq rubriques pour le routier et l’encadrement, quatre pour l’administrateur', () => {
    const rubriques = (user: NavUser) => navigationFor(user).map((group) => group.label);
    // Routier (D198) : Accueil, Cours, Défis, Mon parcours (évaluations officielles comprises),
    // Mon profil.
    expect(rubriques(routier)).toEqual(['Accueil', 'Cours', 'Défis', 'Mon parcours', 'Mon profil']);
    for (const user of [encadrant, adjoint, assistant]) {
      expect(rubriques(user)).toEqual([
        'Accueil',
        'Routiers',
        'Cours',
        'Évaluations',
        'Mon profil',
      ]);
    }
    // Le plein gère aussi les comptes routiers : rubrique « Administration » discrète en plus.
    expect(rubriques(plein)).toEqual([
      'Accueil',
      'Routiers',
      'Cours',
      'Évaluations',
      'Mon profil',
      'Administration',
    ]);
    expect(rubriques(admin)).toEqual(['Accueil', 'Routiers', 'Mon profil', 'Administration']);
  });

  it('apprenant adulte (D185) : cours, évaluations et résultats, aucun parcours Route', () => {
    expect(hrefs(adulte)).toEqual([
      HOME_ROUTE,
      '/modules',
      '/defis',
      '/evaluations',
      '/carnet',
      '/mes-resultats',
      '/compte',
      '/communaute',
    ]);
    for (const path of ['/progression', '/mes-rattrapages', '/mes-competences', '/mes-activites']) {
      expect(canAccessPath(adulte, path), path).toBe(false);
    }
    expect(canAccessPath(adulte, '/mes-resultats')).toBe(true);
    expect(canAccessPath(adulte, '/administration/adultes')).toBe(false);
    expect(bottomTabsFor(adulte).map((tab) => tab.href)).toEqual([
      HOME_ROUTE,
      '/modules',
      '/defis',
      '/evaluations',
    ]);
  });

  it('la rubrique active est celle de la page affichée', () => {
    const groups = navigationFor(plein);
    expect(findActiveGroup(groups, '/administration/modules/abc/revision')?.label).toBe('Cours');
    expect(findActiveGroup(groups, '/encadrement/evaluations/papier/x')?.label).toBe('Évaluations');
    expect(findActiveGroup(groups, '/administration/equipes')?.label).toBe('Routiers');
    expect(findActiveGroup(navigationFor(routier), '/mes-rattrapages')?.label).toBe('Mon parcours');
  });

  it('affiche seulement les fonctionnalités autorisées', () => {
    expect(hrefs(routier)).toContain('/progression');
    expect(hrefs(routier)).not.toContain('/administration/routiers');
    expect(hrefs(encadrant)).toContain('/administration/routiers');
    expect(hrefs(encadrant)).not.toContain('/progression');
    expect(hrefs(admin)).toEqual([
      HOME_ROUTE,
      '/administration/routiers',
      '/administration/adultes',
      '/compte',
      '/administration/comptes',
      '/communaute',
    ]);
  });

  it('un même menu pour l’encadrement, enrichi des seules décisions du plein', () => {
    expect(hrefs(plein)).toContain('/administration/modules-a-valider');
    expect(hrefs(adjoint)).not.toContain('/administration/modules-a-valider');
    expect(hrefs(adjoint)).toEqual(hrefs(encadrant));
    expect(hrefs(assistant)).toEqual(hrefs(encadrant));
    expect(hrefs(encadrant).every((href) => hrefs(plein).includes(href))).toBe(true);
  });

  it('barre mobile : destinations selon les permissions, « Plus » en dernier (D182, D198)', () => {
    const labels = (user: NavUser) => bottomTabsFor(user).map((tab) => tab.label);
    expect(labels(routier)).toEqual(['Accueil', 'Cours', 'Défis', 'Parcours']);
    for (const user of [encadrant, adjoint, assistant, plein])
      expect(labels(user)).toEqual(['Accueil', 'Routiers', 'Cours']);
    expect(labels(admin)).toEqual(['Accueil', 'Routiers', 'Comptes']);
    expect(bottomTabsFor(plein)[2]!.href).toBe('/encadrement/modules');
    expect(bottomTabsFor(routier)[1]!.href).toBe('/modules');
  });

  it.each(Object.entries(ALL))(
    '%s : onglets existants, autorisés et liés à une rubrique',
    (_, user) => {
      const groups = navigationFor(user).map((group) => group.label);
      for (const tab of bottomTabsFor(user)) {
        expect(pageExists(tab.href), tab.href).toBe(true);
        expect(canAccessPath(user, tab.href), tab.href).toBe(true);
        expect(groups, tab.group).toContain(tab.group);
      }
    },
  );

  it.each(Object.entries(ALL))(
    '%s : « Plus » complète les onglets sans doublon ni oubli',
    (_, user) => {
      const tabs = bottomTabsFor(user).map((tab) => tab.href);
      const more = moreNavigationFor(user).flatMap((group) => group.items.map((item) => item.href));
      expect(more.filter((href) => tabs.includes(href))).toEqual([]);
      expect(new Set([...tabs, ...more])).toEqual(new Set(hrefs(user)));
    },
  );

  it('onglet actif : rubrique de la page, y compris ses sous-pages ; sinon « Plus »', () => {
    const active = (user: NavUser, path: string) => activeBottomTab(user, path)?.label ?? 'Plus';
    expect(active(routier, '/accueil')).toBe('Accueil');
    expect(active(routier, '/modules/priere/lecons/abc')).toBe('Cours');
    expect(active(routier, '/mes-rattrapages')).toBe('Parcours');
    expect(active(routier, '/evaluations')).toBe('Parcours');
    expect(active(routier, '/defis/express')).toBe('Défis');
    expect(active(routier, '/compte')).toBe('Plus');
    expect(active(plein, '/administration/routiers/123')).toBe('Routiers');
    expect(active(plein, '/administration/equipes')).toBe('Routiers');
    expect(active(plein, '/encadrement/modules/1/modifier')).toBe('Cours');
    expect(active(plein, '/modules/priere')).toBe('Cours');
    expect(active(plein, '/administration/modules-a-valider')).toBe('Cours');
    expect(active(plein, '/encadrement/evaluations')).toBe('Plus');
    expect(active(admin, '/administration/comptes')).toBe('Comptes');
    expect(active(admin, '/communaute')).toBe('Plus');
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
  it('« Mon profil » est accessible à tout utilisateur connecté', () => {
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
