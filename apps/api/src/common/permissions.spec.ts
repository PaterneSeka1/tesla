import { can } from './permissions.js';

const chef = { userId: 'chef', role: 'CHEF' } as const;
const responsable = { userId: 'resp', role: 'RESPONSABLE' } as const;
const routier = { userId: 'routier', role: 'ROUTIER' } as const;

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
