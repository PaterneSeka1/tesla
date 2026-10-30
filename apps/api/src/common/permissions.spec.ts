import { type AccessLevel, PERMISSION_KEYS, PERMISSIONS } from '@tesla/shared';
import { can } from './permissions.js';

const chef = {
  userId: 'chef',
  role: 'ENCADREMENT',
  leaderFunction: 'ASSISTANT',
} as const;
const responsable = {
  userId: 'resp',
  role: 'ENCADREMENT',
  leaderFunction: 'PLEIN',
} as const;
const routier = {
  userId: 'routier',
  role: 'ROUTIER',
  leaderFunction: null,
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

describe('Fonctions d’encadrement, sans mandat ni délégation (D132)', () => {
  const encadrement = (leaderFunction: 'PLEIN' | 'ADJOINT' | 'ASSISTANT' | null) =>
    ({ userId: 'u', role: 'ENCADREMENT', leaderFunction }) as const;
  const admin = { userId: 'a', role: 'ADMINISTRATEUR', leaderFunction: null } as const;
  const official = PERMISSION_KEYS.filter((key) =>
    (PERMISSIONS[key] as readonly AccessLevel[]).includes('OFFICIEL'),
  );

  it('seul le responsable plein en fonction détient les décisions officielles', () => {
    expect(official.length).toBeGreaterThan(10);
    for (const permission of official) {
      expect(can(encadrement('PLEIN'), permission)).toBe(true);
      expect(can(encadrement('ADJOINT'), permission)).toBe(false);
      expect(can(encadrement('ASSISTANT'), permission)).toBe(false);
      expect(can(encadrement(null), permission)).toBe(false);
    }
  });

  it('préserve consultation, rédaction et accompagnement pour tout l’encadrement', () => {
    for (const permission of [
      'scout.read',
      'module.write',
      'observation.create',
      'attempt.record',
    ] as const) {
      for (const fn of ['PLEIN', 'ADJOINT', 'ASSISTANT', null] as const) {
        expect(can(encadrement(fn), permission)).toBe(true);
      }
    }
  });

  it('l’administrateur désigne l’encadrement, sans aucun droit pédagogique', () => {
    expect(can(admin, 'leadership.manage')).toBe(true);
    expect(can(encadrement('PLEIN'), 'leadership.manage')).toBe(false);
    expect(can(admin, 'scout.read')).toBe(false);
    expect(can(admin, 'module.read')).toBe(false);
    expect(can(admin, 'module.review')).toBe(false);
  });

  it('tout membre connecté voit la composition de l’encadrement', () => {
    for (const actor of [routier, chef, responsable, admin]) {
      expect(can(actor, 'leadership.read')).toBe(true);
    }
  });

  it('comptes : administrateur et responsable plein seulement (D119)', () => {
    expect(can(admin, 'account.manage')).toBe(true);
    expect(can(encadrement('PLEIN'), 'account.manage')).toBe(true);
    expect(can(encadrement('ADJOINT'), 'account.read')).toBe(false);
    expect(can({ userId: 'r', role: 'ROUTIER', leaderFunction: null }, 'account.read')).toBe(false);
  });
});
