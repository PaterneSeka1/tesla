import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ORIGINS,
  ACTIVITY_STATUSES,
  ATTENDANCE_STATUSES,
  changeStageInputSchema,
  COMPETENCY_DECISIONS,
  computeCompetencyStatus,
  createCompetencyInputSchema,
  createProposalInputSchema,
  EVIDENCE_KINDS,
  parseProgrammeDate,
  parseProgrammeMarkdown,
  programmeImportKey,
  PROPOSAL_ACTIONS,
  PROPOSAL_STATUSES,
  saveAttendanceInputSchema,
  STAGE_CHANGE_KINDS,
  statisticsQuerySchema,
  STUDY_MODES,
} from '@tesla/shared';
import { can } from '../../common/permissions.js';
import {
  ActivityAction,
  ActivityOrigin,
  ActivityStatus,
  AttendanceStatus,
  CompetencyDecision,
  CompetencyProposalAction,
  CompetencyProposalStatus,
  EvidenceKind,
  StageChangeKind,
  StudyMode,
} from '../../generated/prisma/enums.js';

const ID = '0190f3a1-0000-7000-8000-000000000001';
const ID2 = '0190f3a1-0000-7000-8000-000000000002';

describe('Synchronisation des enums de la phase 4 (Prisma ↔ @tesla/shared)', () => {
  it.each([
    ['StageChangeKind', StageChangeKind, STAGE_CHANGE_KINDS],
    ['CompetencyProposalStatus', CompetencyProposalStatus, PROPOSAL_STATUSES],
    ['CompetencyProposalAction', CompetencyProposalAction, PROPOSAL_ACTIONS],
    ['EvidenceKind', EvidenceKind, EVIDENCE_KINDS],
    ['CompetencyDecision', CompetencyDecision, COMPETENCY_DECISIONS],
    ['StudyMode', StudyMode, STUDY_MODES],
    ['ActivityStatus', ActivityStatus, ACTIVITY_STATUSES],
    ['ActivityOrigin', ActivityOrigin, ACTIVITY_ORIGINS],
    ['ActivityAction', ActivityAction, ACTIVITY_ACTIONS],
    ['AttendanceStatus', AttendanceStatus, ATTENDANCE_STATUSES],
  ] as const)('%s', (_name, prismaEnum, shared) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...shared].sort());
  });
});

describe('Statut d’une compétence (aucune validation automatique)', () => {
  const none = {
    hasActiveAcquired: false,
    openProposal: null,
    latestDecision: null,
    hasWork: false,
  };

  it('seule une validation officielle active donne « acquis »', () => {
    expect(computeCompetencyStatus({ ...none, hasActiveAcquired: true })).toBe('ACQUIS');
  });

  it('un travail engagé (quiz, étude, présence) ne donne jamais « acquis »', () => {
    expect(computeCompetencyStatus({ ...none, hasWork: true })).toBe('EN_COURS');
    expect(computeCompetencyStatus(none)).toBe('NON_EVALUE');
  });

  it('distingue proposition, complément et décision « à retravailler »', () => {
    expect(computeCompetencyStatus({ ...none, openProposal: 'EN_ATTENTE' })).toBe('PROPOSE');
    expect(computeCompetencyStatus({ ...none, openProposal: 'COMPLEMENT_DEMANDE' })).toBe(
      'EN_COURS',
    );
    expect(computeCompetencyStatus({ ...none, latestDecision: 'A_RETRAVAILLER' })).toBe(
      'A_RETRAVAILLER',
    );
    // Une nouvelle proposition après un refus est affichée comme proposée.
    expect(
      computeCompetencyStatus({
        ...none,
        latestDecision: 'A_RETRAVAILLER',
        openProposal: 'EN_ATTENTE',
      }),
    ).toBe('PROPOSE');
  });
});

describe('Contrats de la phase 4', () => {
  const stageChange = {
    expectedCurrentStageId: null,
    toStageId: ID,
    effectiveOn: '2026-10-24',
    reason: 'Décision fictive motivée',
  };

  it('le changement d’étape exige une confirmation explicite et un motif', () => {
    expect(changeStageInputSchema.safeParse(stageChange).success).toBe(false);
    expect(changeStageInputSchema.safeParse({ ...stageChange, confirm: true }).success).toBe(true);
    expect(
      changeStageInputSchema.safeParse({ ...stageChange, confirm: true, reason: ' ' }).success,
    ).toBe(false);
  });

  it('normalise le code de compétence et borne le nombre de preuves exigées', () => {
    const parsed = createCompetencyInputSchema.parse({ code: 'serv-01', name: 'Service fictif' });
    expect(parsed).toMatchObject({ code: 'SERV-01', minEvidenceCount: 1, observableCriteria: [] });
    expect(
      createCompetencyInputSchema.safeParse({ code: 'serv 01', name: 'Service fictif' }).success,
    ).toBe(false);
    expect(
      createCompetencyInputSchema.safeParse({ code: 'A', name: 'Nom', minEvidenceCount: 0 })
        .success,
    ).toBe(false);
  });

  it('un élément justificatif « autre » exige une description', () => {
    const base = { scoutProfileId: ID, competencyId: ID2, justification: 'Justification fictive' };
    expect(
      createProposalInputSchema.safeParse({ ...base, evidences: [{ kind: 'AUTRE' }] }).success,
    ).toBe(false);
    expect(
      createProposalInputSchema.safeParse({
        ...base,
        evidences: [{ kind: 'AUTRE', description: 'Service observé' }],
      }).success,
    ).toBe(true);
  });

  it('refuse une saisie de présence en double et le statut « non renseigné »', () => {
    expect(
      saveAttendanceInputSchema.safeParse({
        entries: [
          { scoutProfileId: ID, status: 'PRESENT' },
          { scoutProfileId: ID, status: 'ABSENT' },
        ],
      }).success,
    ).toBe(false);
    expect(
      saveAttendanceInputSchema.safeParse({
        entries: [{ scoutProfileId: ID, status: 'NON_RENSEIGNE' }],
      }).success,
    ).toBe(false);
  });

  it('valide l’ordre des dates des statistiques', () => {
    expect(statisticsQuerySchema.safeParse({ from: '2026-11-01', to: '2026-10-01' }).success).toBe(
      false,
    );
  });
});

describe('Analyse du programme annuel (Markdown)', () => {
  const table = [
    '| Date | Catégories | Thème | Activité | Objectifs | Modules |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 2026-11-07 | Novices Routiers, Aspirants Routiers | Thème fictif | Séance fictive A | Objectif 1; Objectif 2 | mod-001 |',
    '| 14/11/2026 | | | Séance fictive B | | |',
  ].join('\n');

  it('extrait les lignes, normalise dates, listes et codes de module', () => {
    const { rows, errors } = parseProgrammeMarkdown(table);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 3,
      date: '2026-11-07',
      title: 'Séance fictive A',
      categories: ['Novices Routiers', 'Aspirants Routiers'],
      objectives: ['Objectif 1', 'Objectif 2'],
      moduleCodes: ['MOD-001'],
    });
    expect(rows[1]).toMatchObject({ date: '2026-11-14', theme: null, categories: [] });
  });

  it('signale dates invalides et doublons sans rien inventer', () => {
    const { rows, errors } = parseProgrammeMarkdown(
      `${table}\n| 2026-02-30 | | | Séance fictive C | | |\n| 2026-11-07 | | | séance FICTIVE a | | |`,
    );
    expect(rows).toHaveLength(2);
    expect(errors.map((error) => error.line)).toEqual([5, 6]);
    expect(errors[1]?.message).toContain('Doublon de la ligne 3');
  });

  it('exige les colonnes Date et Activité', () => {
    expect(parseProgrammeMarkdown('| Thème |\n| --- |\n| x |').errors[0]?.message).toContain(
      'En-tête invalide',
    );
    expect(parseProgrammeMarkdown('Aucun tableau').errors[0]?.message).toContain('Aucun tableau');
  });

  it('produit une clé d’import stable (idempotence)', () => {
    expect(programmeImportKey('2026-11-07', 'Séance  Fictive A !')).toBe(
      programmeImportKey('2026-11-07', 'seance fictive a'),
    );
    expect(parseProgrammeDate('31/04/2026')).toBeNull();
    expect(parseProgrammeDate('7/11/2026')).toBe('2026-11-07');
  });
});

describe('Permissions de la phase 4', () => {
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

  it('seul le responsable décide, administre le référentiel et configure le programme', () => {
    for (const permission of [
      'competency.decide',
      'competency.manage',
      'programme.configure',
      'scout.setStage',
      'dashboard.official',
    ] as const) {
      expect(can(responsable, permission)).toBe(true);
      expect(can(chef, permission)).toBe(false);
      expect(can(routier, permission)).toBe(false);
    }
  });

  it('un chef propose, enregistre études, activités et présences', () => {
    for (const permission of [
      'competency.propose',
      'moduleStudy.record',
      'activity.manage',
      'attendance.record',
      'progression.read',
    ] as const) {
      expect(can(chef, permission)).toBe(true);
      expect(can(routier, permission)).toBe(false);
    }
  });

  it('un routier ne lit que sa propre progression', () => {
    expect(can(routier, 'progression.readOwn')).toBe(true);
    expect(can(routier, 'progression.read')).toBe(false);
    expect(can(chef, 'progression.readOwn')).toBe(false);
  });
});
