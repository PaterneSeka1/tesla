import { ATTEMPT_STATUSES } from '@tesla/shared';
import { assertTransition, canTransition } from './attempt-workflow.js';
import { isStageEligible, isWaiverActive } from './eligibility.js';

describe('Cycle de vie des tentatives', () => {
  it('une décision (VALIDEE/REFUSEE) n’est possible qu’après soumission', () => {
    for (const from of ATTEMPT_STATUSES) {
      expect(canTransition(from, 'VALIDEE')).toBe(from === 'SOUMISE');
      expect(canTransition(from, 'REFUSEE')).toBe(from === 'SOUMISE');
    }
  });

  it('une tentative annulée est définitive', () => {
    for (const to of ATTEMPT_STATUSES) expect(canTransition('ANNULEE', to)).toBe(false);
  });

  it('une tentative décidée ne peut être que rouverte (correction tracée)', () => {
    expect(canTransition('VALIDEE', 'A_CORRIGER')).toBe(true);
    expect(canTransition('VALIDEE', 'SOUMISE')).toBe(false);
    expect(() => assertTransition('VALIDEE', 'ANNULEE')).toThrow();
  });
});

describe('Éligibilité', () => {
  const now = new Date('2027-01-10T00:00:00Z');

  it('exige l’étape courante du routier', () => {
    expect(isStageEligible('etape-1', 'etape-1')).toBe(true);
    expect(isStageEligible('etape-1', 'etape-2')).toBe(false);
    expect(isStageEligible(null, 'etape-1')).toBe(false);
  });

  it('une dérogation révoquée ou expirée n’est plus active', () => {
    expect(isWaiverActive({ revokedAt: null, expiresAt: null }, now)).toBe(true);
    expect(isWaiverActive({ revokedAt: now, expiresAt: null }, now)).toBe(false);
    expect(
      isWaiverActive({ revokedAt: null, expiresAt: new Date('2027-01-09T00:00:00Z') }, now),
    ).toBe(false);
  });
});
