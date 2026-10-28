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
