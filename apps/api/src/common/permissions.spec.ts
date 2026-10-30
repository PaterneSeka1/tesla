import { DELEGABLE_PERMISSIONS, type Permission } from '@tesla/shared';
import { can } from './permissions.js';

const chef = {
  userId: 'chef',
  role: 'ENCADREMENT',
  leaderFunction: 'ASSISTANT',
  delegated: [],
} as const;
const responsable = {
  userId: 'resp',
  role: 'ENCADREMENT',
  leaderFunction: 'PLEIN',
  delegated: [],
} as const;
const routier = {
  userId: 'routier',
  role: 'ROUTIER',
  leaderFunction: null,
  delegated: [],
} as const;

describe('Permissions', () => {
  it('seul le responsable décide d’un résultat et accorde une dérogation', () => {
    expect(can(responsable, 'attempt.decide')).toBe(true);
    expect(can(chef, 'attempt.decide')).toBe(false);
    expect(can(chef, 'waiver.manage')).toBe(false);
    expect(can(chef, 'attempt.reopen')).toBe(false);
  });

  it('un chef prépare et saisit les tentatives papier', () => {
    expect(can(chef, 'attempt.preparePaper')).toBe(true);
    expect(can(chef, 'attempt.record')).toBe(true);
  });

  it('un routier ne lit pas les tentatives des autres', () => {
    expect(can(routier, 'attempt.readAny')).toBe(false);
    expect(can(routier, 'attempt.preparePaper')).toBe(false);
  });
});

describe('Permissions des routiers, équipes et observations', () => {
  it('le responsable gère fiches, étapes, équipes et affectations', () => {
    for (const permission of [
      'scout.create',
      'scout.update',
      'scout.setStage',
      'scout.setActive',
      'scout.linkAccount',
      'team.manage',
      'team.assign',
    ] as const) {
      expect(can(responsable, permission)).toBe(true);
      expect(can(chef, permission)).toBe(false);
      expect(can(routier, permission)).toBe(false);
    }
  });

  it('un chef consulte les routiers et saisit des observations', () => {
    expect(can(chef, 'scout.read')).toBe(true);
    expect(can(chef, 'team.read')).toBe(true);
    expect(can(chef, 'observation.create')).toBe(true);
    expect(can(chef, 'observation.readRestricted')).toBe(false);
  });

  it('un routier n’accède ni aux fiches ni aux observations', () => {
    expect(can(routier, 'scout.read')).toBe(false);
    expect(can(routier, 'observation.read')).toBe(false);
  });
});

describe('Permissions des modules pédagogiques', () => {
  it('tout utilisateur connecté lit la bibliothèque', () => {
    for (const actor of [routier, chef, responsable]) expect(can(actor, 'module.read')).toBe(true);
  });

  it('un chef rédige mais ne décide jamais de la publication', () => {
    expect(can(chef, 'module.write')).toBe(true);
    expect(can(chef, 'module.writeAny')).toBe(false);
    expect(can(chef, 'module.review')).toBe(false);
    expect(can(responsable, 'module.review')).toBe(true);
  });

  it('un routier ne rédige pas', () => {
    expect(can(routier, 'module.write')).toBe(false);
  });
});

describe('Fonctions, mandats et délégations (D94)', () => {
  const encadrement = (
    leaderFunction: 'PLEIN' | 'ADJOINT' | 'ASSISTANT' | null,
    delegated: Permission[] = [],
  ) => ({ userId: 'u', role: 'ENCADREMENT', leaderFunction, delegated }) as const;
  const admin = {
    userId: 'a',
    role: 'ADMINISTRATEUR',
    leaderFunction: null,
    delegated: [],
  } as const;

  it('le rôle ENCADREMENT seul n’accorde aucune décision officielle', () => {
    for (const permission of DELEGABLE_PERMISSIONS) {
      expect(can(encadrement(null), permission)).toBe(false);
      expect(can(encadrement('ADJOINT'), permission)).toBe(false);
      expect(can(encadrement('PLEIN'), permission)).toBe(true);
    }
  });

  it('préserve consultation, rédaction et accompagnement pour tout l’encadrement', () => {
    for (const permission of [
      'scout.read',
      'module.write',
      'observation.create',
      'attempt.record',
    ] as const) {
      expect(can(encadrement(null), permission)).toBe(true);
    }
  });

  it('une délégation n’accorde que les permissions déléguées', () => {
    const adjoint = encadrement('ADJOINT', ['module.review']);
    expect(can(adjoint, 'module.review')).toBe(true);
    expect(can(adjoint, 'competency.decide')).toBe(false);
  });

  it('les permissions du plein ne sont jamais délégables', () => {
    expect(DELEGABLE_PERMISSIONS).not.toContain('delegation.manage');
    expect(DELEGABLE_PERMISSIONS).not.toContain('mandate.recordTeam');
    expect(can(encadrement('ADJOINT', ['delegation.manage']), 'delegation.manage')).toBe(false);
  });

  it('le plein ne consigne pas sa propre nomination ; l’administration technique n’a aucun droit pédagogique', () => {
    expect(can(encadrement('PLEIN'), 'mandate.recordPlein')).toBe(false);
    expect(can(encadrement('PLEIN'), 'mandate.recordTeam')).toBe(true);
    expect(can(admin, 'mandate.recordPlein')).toBe(true);
    expect(can(admin, 'scout.read')).toBe(false);
    expect(can(admin, 'module.read')).toBe(false);
  });

  it('comptes : administration technique et décision officielle seulement (D119)', () => {
    expect(can(admin, 'account.manage')).toBe(true);
    expect(can(encadrement('PLEIN'), 'account.manage')).toBe(true);
    expect(can(encadrement('ADJOINT'), 'account.read')).toBe(false);
    expect(can(encadrement('ADJOINT', ['account.manage']), 'account.manage')).toBe(true);
    expect(
      can({ userId: 'r', role: 'ROUTIER', leaderFunction: null, delegated: [] }, 'account.read'),
    ).toBe(false);
  });
});
