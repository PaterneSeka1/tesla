import { computeEligibility, type EligibilityFacts } from './eligibility.js';

const NOW = new Date('2027-01-10T10:00:00Z');
const STAGE = 'stage-noviciat';

const facts = (overrides: Partial<EligibilityFacts> = {}): EligibilityFacts => ({
  profile: { isActive: true, currentStageId: STAGE },
  evaluationStageId: STAGE,
  maxAttempts: null,
  attempts: [],
  waivers: [],
  now: NOW,
  ...overrides,
});

const waiver = (overrides: object = {}) => ({
  id: 'w1',
  reason: 'Motif fictif',
  grantedAt: new Date('2027-01-01T00:00:00Z'),
  revokedAt: null,
  expiresAt: null,
  ...overrides,
});

describe('Éligibilité aux évaluations', () => {
  it('accessible à l’étape correspondante, sans dérogation', () => {
    expect(computeEligibility(facts())).toMatchObject({ status: 'ELIGIBLE', allowed: true });
  });

  it('refusée hors étape sans dérogation', () => {
    const result = computeEligibility(facts({ evaluationStageId: 'stage-apprentissage' }));
    expect(result).toMatchObject({ status: 'ETAPE_NON_CORRESPONDANTE', allowed: false });
  });

  it('une dérogation active lève la condition d’étape', () => {
    const result = computeEligibility(
      facts({ evaluationStageId: 'stage-apprentissage', waivers: [waiver()] }),
    );
    expect(result).toMatchObject({ status: 'ELIGIBLE_DEROGATION', allowed: true });
    expect(result.waiver?.id).toBe('w1');
  });

  it('une dérogation révoquée ou expirée ne permet plus le passage', () => {
    for (const inactive of [
      waiver({ revokedAt: new Date('2027-01-05T00:00:00Z') }),
      waiver({ expiresAt: new Date('2027-01-09T00:00:00Z') }),
    ]) {
      expect(
        computeEligibility(facts({ evaluationStageId: 'other', waivers: [inactive] })).allowed,
      ).toBe(false);
    }
  });

  it('applique la limite de tentatives non annulées, même avec dérogation', () => {
    const attempts = [
      { id: 'a1', code: 'NT-2027-000001', mode: 'PAPIER' as const, status: 'VALIDEE' as const },
      { id: 'a2', code: 'NT-2027-000002', mode: 'EN_LIGNE' as const, status: 'ANNULEE' as const },
    ];
    expect(computeEligibility(facts({ maxAttempts: 2, attempts })).allowed).toBe(true);
    expect(computeEligibility(facts({ maxAttempts: 1, attempts }))).toMatchObject({
      status: 'LIMITE_ATTEINTE',
      allowed: false,
      attemptsUsed: 1,
    });
    expect(
      computeEligibility(
        facts({ maxAttempts: 1, attempts, evaluationStageId: 'other', waivers: [waiver()] }),
      ).allowed,
    ).toBe(false);
  });

  it('signale la tentative ouverte à reprendre', () => {
    const open = {
      id: 'a1',
      code: 'NT-2027-000001',
      mode: 'EN_LIGNE' as const,
      status: 'EN_COURS' as const,
    };
    const result = computeEligibility(facts({ maxAttempts: 1, attempts: [open] }));
    expect(result.allowed).toBe(true);
    expect(result.openAttempt?.code).toBe('NT-2027-000001');
  });

  it('refuse un compte sans profil et un profil inactif', () => {
    expect(computeEligibility(facts({ profile: null })).status).toBe('SANS_PROFIL');
    expect(
      computeEligibility(facts({ profile: { isActive: false, currentStageId: STAGE } })).status,
    ).toBe('PROFIL_INACTIF');
  });
});

describe('Éligibilité : appartenance à la branche et rattrapage (refonte)', () => {
  const otherStage = { profile: { isActive: true, currentStageId: 'stage-apprentissage' } };

  it('limite d’âge atteinte : refusée, même à l’étape ou avec une dérogation', () => {
    expect(computeEligibility(facts({ membership: 'SORTI' }))).toMatchObject({
      status: 'SORTI_BRANCHE',
      allowed: false,
    });
    expect(
      computeEligibility(facts({ ...otherStage, membership: 'SORTI', waivers: [waiver()] }))
        .allowed,
    ).toBe(false);
  });

  it('obligation de rattrapage ouverte : évaluation d’une étape antérieure accessible', () => {
    expect(computeEligibility(facts({ ...otherStage, openCatchUp: true }))).toMatchObject({
      status: 'ELIGIBLE_RATTRAPAGE',
      allowed: true,
    });
    expect(computeEligibility(facts({ ...otherStage, openCatchUp: false })).allowed).toBe(false);
  });

  it('le rattrapage ne lève jamais la limite de tentatives', () => {
    const attempts = [
      { id: 'a', code: 'NT-2027-000001', mode: 'EN_LIGNE' as const, status: 'VALIDEE' as const },
    ];
    expect(
      computeEligibility(facts({ ...otherStage, openCatchUp: true, maxAttempts: 1, attempts })),
    ).toMatchObject({ status: 'LIMITE_ATTEINTE', allowed: false });
  });
});
