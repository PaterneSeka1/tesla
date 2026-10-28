import { ROLES } from '@tesla/shared';
import { Role } from '../generated/prisma/enums.js';

describe('Synchronisation des rôles', () => {
  it("l'enum Prisma Role correspond à ROLES de @tesla/shared", () => {
    expect(Object.values(Role).sort()).toEqual([...ROLES].sort());
  });
});
