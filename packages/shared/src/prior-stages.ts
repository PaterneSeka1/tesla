import { z } from 'zod';
import { userSummarySchema } from './api.js';
import {
  type AgeProgression,
  type AgeRuleSetSnapshot,
  compareCivilDates,
  stagePeriods,
} from './age-progression.js';
import {
  correctionReasonSchema,
  priorStageInputSchema,
  type StageAdmissionIssue,
  stageSummarySchema,
} from './scouts.js';

// Parcours officiel d'un routier (D181). Quatre notions distinctes, jamais confondues :
// 1. étape actuelle : calculée selon l'âge (D173), exception de secours éventuelle (D176) ;
// 2. étapes officiellement accomplies : ici, les étapes reconnues au titre du parcours antérieur ;
// 3. progression numérique : études, évaluations et rattrapages sur la plateforme ;
// 4. historique : reconnaissances, révocations, exceptions et décisions, jamais effacés.
// Une reconnaissance n'est jamais une validation de module ni d'acquis.

// ─── Admission : un routier actif a toujours une étape déterminée ──────────

/**
 * Messages affichables par tout profil autorisé à inscrire un routier : ils énoncent un fait (âge,
 * donnée manquante), jamais la règle de calcul (réservée au responsable plein, D176).
 */
export const STAGE_ADMISSION_MESSAGES: Record<StageAdmissionIssue, string> = {
  BIRTH_DATE_REQUIRED:
    'Renseignez la date de naissance : elle seule permet de déterminer l’étape du routier.',
  NO_AGE_RULE_SET:
    'Aucun référentiel d’âge n’est en vigueur : l’étape ne peut pas être déterminée. Le responsable doit en mettre un en vigueur.',
  BELOW_ROUTE_AGE:
    'À cette date de naissance, la personne n’a pas encore l’âge d’entrer dans la branche Route : aucune étape ne peut lui être attribuée.',
  NO_AGE_RULE:
    'Aucune règle d’âge en vigueur ne couvre cette date de naissance : le responsable doit compléter le référentiel.',
  ABOVE_ROUTE_AGE:
    'À cette date de naissance, la personne a déjà atteint l’âge de sortie de la branche : elle ne peut pas être inscrite comme routier actif.',
};

/**
 * Motif empêchant d'enregistrer un routier actif, ou `null` si l'étape est déterminée. Jamais
 * d'étape de substitution : une donnée ou une règle manquante bloque l'enregistrement (D181).
 */
export function stageAdmissionIssue(
  progression: Pick<AgeProgression, 'reason' | 'referenceDate'>,
  birthDate: string | null,
  rules: AgeRuleSetSnapshot | null,
): StageAdmissionIssue | null {
  switch (progression.reason) {
    case 'REGLE':
      return null;
    case 'DATE_NAISSANCE_MANQUANTE':
      return 'BIRTH_DATE_REQUIRED';
    case 'AUCUN_REFERENTIEL':
      return 'NO_AGE_RULE_SET';
    case 'SORTI':
      return 'ABOVE_ROUTE_AGE';
    case 'AUCUNE_REGLE': {
      if (!birthDate || !rules || rules.stages.length === 0) return 'NO_AGE_RULE';
      const first = stagePeriods(birthDate, rules)[0];
      return first && compareCivilDates(progression.referenceDate, first.startsOn) < 0
        ? 'BELOW_ROUTE_AGE'
        : 'NO_AGE_RULE';
    }
  }
}

// ─── Reconnaissance du parcours antérieur ──────────────────────────────────

export const recognizePriorStageInputSchema = priorStageInputSchema.extend({
  /** Version de la fiche vue lors de la saisie : conflit si elle a changé entre-temps. */
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export type RecognizePriorStageInput = z.input<typeof recognizePriorStageInputSchema>;

export const revokePriorStageInputSchema = z.object({
  reason: correctionReasonSchema,
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type RevokePriorStageInput = z.input<typeof revokePriorStageInputSchema>;

export const priorStageRecognitionSchema = z.object({
  id: z.uuid(),
  stage: stageSummarySchema,
  completedOn: z.iso.date().nullable(),
  /** Observation : encadrement seulement (nulle pour le routier). */
  note: z.string().nullable(),
  recordedAt: z.iso.datetime(),
  recordedBy: userSummarySchema.nullable(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: userSummarySchema.nullable(),
  revokeReason: z.string().nullable(),
});

export type PriorStageRecognition = z.infer<typeof priorStageRecognitionSchema>;

export const priorStageListSchema = z.object({ items: z.array(priorStageRecognitionSchema) });

export type PriorStageList = z.infer<typeof priorStageListSchema>;

export const PRIOR_STAGE_ISSUES = [
  'STAGE_UNDETERMINED',
  'UNKNOWN_STAGE',
  'DUPLICATE_STAGE',
  'NOT_PRIOR_STAGE',
  'ALREADY_RECOGNIZED',
  'COMPLETED_ON_INVALID',
] as const;

export type PriorStageIssue = (typeof PRIOR_STAGE_ISSUES)[number];

interface StageRow {
  id: string;
  name: string;
  position: number;
}

/**
 * Contrôle d'une reconnaissance (pur, testable) : seules les étapes **antérieures** à l'étape
 * actuelle selon l'âge se reconnaissent ; une étape déjà reconnue ne l'est pas deux fois ; une date
 * de fin connue se situe entre la naissance et aujourd'hui. Renvoie le premier motif de refus.
 */
export function priorStageIssue(input: {
  requested: readonly { stageId: string; completedOn?: string | null }[];
  stages: readonly StageRow[];
  currentStage: StageRow | null;
  alreadyRecognized: ReadonlySet<string>;
  birthDate: string | null;
  today: string;
}): { code: PriorStageIssue; message: string } | null {
  const { requested, stages, currentStage, alreadyRecognized, birthDate, today } = input;
  if (!currentStage || !birthDate) {
    return {
      code: 'STAGE_UNDETERMINED',
      message:
        'L’étape actuelle de ce routier n’est pas déterminée : régularisez d’abord sa fiche (date de naissance).',
    };
  }
  const seen = new Set<string>();
  for (const item of requested) {
    const stage = stages.find((row) => row.id === item.stageId);
    if (!stage) return { code: 'UNKNOWN_STAGE', message: 'Étape inconnue.' };
    if (seen.has(stage.id)) {
      return { code: 'DUPLICATE_STAGE', message: `L’étape ${stage.name} est indiquée deux fois.` };
    }
    seen.add(stage.id);
    if (stage.position >= currentStage.position) {
      return {
        code: 'NOT_PRIOR_STAGE',
        message: `Seules les étapes antérieures à l’étape actuelle (${currentStage.name}) peuvent être reconnues.`,
      };
    }
    if (alreadyRecognized.has(stage.id)) {
      return {
        code: 'ALREADY_RECOGNIZED',
        message: `L’étape ${stage.name} est déjà reconnue pour ce routier.`,
      };
    }
    if (
      item.completedOn &&
      (compareCivilDates(item.completedOn, today) > 0 ||
        compareCivilDates(item.completedOn, birthDate) <= 0)
    ) {
      return {
        code: 'COMPLETED_ON_INVALID',
        message: 'La date de fin d’étape doit être passée et postérieure à la naissance.',
      };
    }
  }
  return null;
}

// ─── Frise du parcours ─────────────────────────────────────────────────────

export const PATHWAY_STEP_STATUSES = ['RECONNUE', 'TERMINEE', 'EN_COURS', 'A_VENIR'] as const;

export type PathwayStepStatus = (typeof PATHWAY_STEP_STATUSES)[number];

/**
 * « Terminée » signifie seulement que la période de l'étape est écoulée : l'âge ne prouve jamais une
 * cérémonie (D176) ; seule une reconnaissance porte la mention « Parcours antérieur reconnu ».
 */
export const PATHWAY_STEP_STATUS_LABELS: Record<PathwayStepStatus, string> = {
  RECONNUE: 'Parcours antérieur reconnu',
  TERMINEE: 'Période terminée',
  EN_COURS: 'En cours',
  A_VENIR: 'À venir',
};

export const pathwayStepSchema = z.object({
  stage: stageSummarySchema,
  status: z.enum(PATHWAY_STEP_STATUSES),
  /** Reconnaissance en vigueur pour cette étape (date de fin connue éventuelle). */
  recognition: z.object({ id: z.uuid(), completedOn: z.iso.date().nullable() }).nullable(),
});

export type PathwayStep = z.infer<typeof pathwayStepSchema>;

/**
 * Frise ordonnée (pure) : l'étape actuelle prime (« En cours ») ; une étape reconnue est « Parcours
 * antérieur reconnu » ; une période échue sans reconnaissance est « Période terminée » ; le reste
 * est « À venir ».
 */
export function pathwayTimeline(input: {
  stages: readonly (StageRow & { code: string })[];
  currentStageId: string | null;
  endedStageCodes: ReadonlySet<string>;
  recognitions: readonly { id: string; stageId: string; completedOn: string | null }[];
}): PathwayStep[] {
  return [...input.stages]
    .sort((a, b) => a.position - b.position)
    .map((stage) => {
      const recognition = input.recognitions.find((row) => row.stageId === stage.id) ?? null;
      const status: PathwayStepStatus =
        stage.id === input.currentStageId
          ? 'EN_COURS'
          : recognition
            ? 'RECONNUE'
            : input.endedStageCodes.has(stage.code)
              ? 'TERMINEE'
              : 'A_VENIR';
      return {
        stage: { id: stage.id, code: stage.code, name: stage.name, position: stage.position },
        status,
        recognition: recognition && { id: recognition.id, completedOn: recognition.completedOn },
      };
    });
}
