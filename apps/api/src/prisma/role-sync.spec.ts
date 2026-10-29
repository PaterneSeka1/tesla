import { LEADER_FUNCTIONS, LEGACY_ROLES, ROLES } from '@tesla/shared';
import { LeaderFunction, Role } from '../generated/prisma/enums.js';

describe('Synchronisation des rôles', () => {
  it("l'enum Prisma Role correspond à ROLES et aux rôles historiques de @tesla/shared", () => {
    expect(Object.values(Role).sort()).toEqual([...ROLES, ...LEGACY_ROLES].sort());
  });

  it("l'enum Prisma LeaderFunction correspond à LEADER_FUNCTIONS", () => {
    expect(Object.values(LeaderFunction).sort()).toEqual([...LEADER_FUNCTIONS].sort());
  });
});
