import { stageAdmissionIssue } from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';
import { computedStageOf, loadStageContext } from './computed-stage.js';
import { endedStages } from './catch-up-lock.js';

// Diagnostic des parcours (D181), **lecture seule** : repère les fiches qui violent l'invariant
// « routier actif = une étape déterminée » ou dont l'historique est incohérent. Ne corrige rien :
// une étape ne se déduit que de la date de naissance, que seul un humain peut renseigner ; une
// supposition n'est jamais transformée en décision. Rapport sans nom ni date de naissance.

export const STAGE_ANOMALIES = {
  DATE_NAISSANCE_MANQUANTE:
    'Routier actif sans date de naissance : étape indéterminable. À compléter par l’administrateur ou le plein.',
  AGE_AVANT_ENTREE:
    'Date de naissance antérieure à l’âge d’entrée dans la Route : à vérifier (erreur de saisie probable).',
  REFERENTIEL_INCOMPLET:
    'Aucune règle d’âge en vigueur ne couvre ce routier : le responsable doit compléter le référentiel.',
  SORTIE_NON_ENREGISTREE:
    'Âge de sortie atteint mais sortie non enregistrée : régularisée par le traitement quotidien (jobs:daily).',
  RECONNAISSANCE_INCOHERENTE:
    'Étape reconnue au titre du parcours antérieur qui n’est plus antérieure à l’étape actuelle (date de naissance corrigée ?) : à réexaminer par le plein.',
  RATTRAPAGE_A_REEXAMINER:
    'Obligation de rattrapage dont l’étape d’origine n’est plus échue : décision humaine attendue.',
} as const;

export type StageAnomalyCode = keyof typeof STAGE_ANOMALIES;

export interface StageDiagnosisRow {
  scoutProfileId: string;
  anomalies: StageAnomalyCode[];
}

export interface StageDiagnosis {
  referenceDate: string;
  ruleSetVersion: string | null;
  activeProfiles: number;
  rows: StageDiagnosisRow[];
  counts: Partial<Record<StageAnomalyCode, number>>;
}

type Reader = Pick<
  Prisma.TransactionClient,
  | 'ageRuleSet'
  | 'progressionStage'
  | 'stageOverride'
  | 'scoutProfile'
  | 'priorStageRecognition'
  | 'catchUpObligation'
>;

export async function diagnoseStages(db: Reader, today?: string): Promise<StageDiagnosis> {
  const context = await loadStageContext(db, today);
  const profiles = await db.scoutProfile.findMany({
    where: { kind: 'ROUTIER', isActive: true, membershipStatus: 'ACTIF' },
    select: { id: true, birthDate: true, membershipStatus: true },
    orderBy: { createdAt: 'asc' },
  });
  const ids = profiles.map((p) => p.id);
  const [recognitions, obligations] = await Promise.all([
    db.priorStageRecognition.findMany({
      where: { revokedAt: null, scoutProfileId: { in: ids } },
      select: { scoutProfileId: true, stage: { select: { position: true } } },
    }),
    db.catchUpObligation.findMany({
      where: { decision: null, scoutProfileId: { in: ids } },
      select: { scoutProfileId: true, originStage: { select: { code: true } } },
    }),
  ]);
  const rows: StageDiagnosisRow[] = [];
  for (const profile of profiles) {
    const anomalies: StageAnomalyCode[] = [];
    const birthDate = profile.birthDate && profile.birthDate.toISOString().slice(0, 10);
    const computed = computedStageOf(profile, context);
    const issue = stageAdmissionIssue(computed.normalProgression, birthDate, context.rules);
    if (issue === 'BIRTH_DATE_REQUIRED') anomalies.push('DATE_NAISSANCE_MANQUANTE');
    else if (issue === 'BELOW_ROUTE_AGE') anomalies.push('AGE_AVANT_ENTREE');
    else if (issue === 'NO_AGE_RULE' || issue === 'NO_AGE_RULE_SET')
      anomalies.push('REFERENTIEL_INCOMPLET');
    else if (issue === 'ABOVE_ROUTE_AGE') anomalies.push('SORTIE_NON_ENREGISTREE');
    const current = computed.computedStage;
    if (
      recognitions.some(
        (r) =>
          r.scoutProfileId === profile.id && (!current || r.stage.position >= current.position),
      )
    ) {
      anomalies.push('RECONNAISSANCE_INCOHERENTE');
    }
    const ended = endedStages(birthDate, context.rules, context.today);
    if (
      obligations.some((o) => o.scoutProfileId === profile.id && !ended.has(o.originStage.code))
    ) {
      anomalies.push('RATTRAPAGE_A_REEXAMINER');
    }
    if (anomalies.length > 0) rows.push({ scoutProfileId: profile.id, anomalies });
  }
  const counts: Partial<Record<StageAnomalyCode, number>> = {};
  for (const row of rows) for (const code of row.anomalies) counts[code] = (counts[code] ?? 0) + 1;
  return {
    referenceDate: context.today,
    ruleSetVersion: context.ruleSet?.version ?? null,
    activeProfiles: profiles.length,
    rows,
    counts,
  };
}
