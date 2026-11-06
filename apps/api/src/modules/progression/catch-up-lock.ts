import {
  type AgeRuleSetSnapshot,
  compareCivilDates,
  type CatchUpLock,
  stagePeriods,
} from '@tesla/shared';
import { type Prisma, type ProgressionStage } from '../../generated/prisma/client.js';
import { computedStageOf, type StageContext } from './computed-stage.js';

// Verrou des rattrapages (D177), calculé à chaque lecture, sans tâche planifiée : tant qu'une étape
// antérieure reste à rattraper, le routier n'accède qu'aux modules à rattraper de cette étape (et
// des étapes déjà rattrapées, ainsi qu'aux textes qu'ils citent) ; les autres cours et évaluations
// sont fermés. Les étapes se rattrapent dans l'ordre du parcours. Une obligation cesse de retenir
// le routier dès qu'un résultat est accepté (décision du responsable sur l'évaluation) ou qu'une
// décision humaine (acquis, non applicable) est prise ; elle n'est jamais supprimée.

const iso = (date: Date): string => date.toISOString().slice(0, 10);

type LockReader = Pick<
  Prisma.TransactionClient,
  'catchUpObligation' | 'evaluationAttempt' | 'moduleTextLink' | 'scoutProfile'
>;

/** Étapes dont la période est échue à la date de référence, avec leur date d'échéance. */
export function endedStages(
  birthDate: string | null,
  rules: AgeRuleSetSnapshot | null,
  referenceDate: string,
): Map<string, string> {
  if (!birthDate || !rules) return new Map();
  return new Map(
    stagePeriods(birthDate, rules)
      .filter(
        (period) => period.endsOn !== null && compareCivilDates(period.endsOn, referenceDate) <= 0,
      )
      .map((period) => [period.stageCode, period.endsOn!]),
  );
}

export interface ComputedCatchUpLock {
  active: boolean;
  stage: ProgressionStage | null;
  dueOn: string | null;
  /** Modules ouverts pendant le verrou (rattrapages jusqu'à l'étape en cours, textes cités). */
  allowedModuleIds: ReadonlySet<string>;
  /** Modules dont l'obligation retient encore le routier. */
  blockingModuleIds: ReadonlySet<string>;
}

export const NO_LOCK: ComputedCatchUpLock = {
  active: false,
  stage: null,
  dueOn: null,
  allowedModuleIds: new Set(),
  blockingModuleIds: new Set(),
};

/** Le module est-il fermé pour ce routier ? */
export function isModuleLocked(lock: ComputedCatchUpLock, moduleId: string | null): boolean {
  return lock.active && (moduleId === null || !lock.allowedModuleIds.has(moduleId));
}

export function toCatchUpLock(lock: ComputedCatchUpLock): CatchUpLock {
  return {
    active: lock.active,
    stage: lock.stage && {
      id: lock.stage.id,
      code: lock.stage.code,
      name: lock.stage.name,
      position: lock.stage.position,
    },
    dueOn: lock.dueOn,
    allowedModuleIds: [...lock.allowedModuleIds],
  };
}

/**
 * Verrou d'un profil (requêtes successives : utilisable dans une transaction interactive). Aucun
 * verrou pour un routier sorti de la branche (déjà fermé à toute nouvelle activité) ni sans
 * obligation bloquante.
 */
export async function loadCatchUpLock(
  db: LockReader,
  profile: { id: string; birthDate: Date | null; membershipStatus?: 'ACTIF' | 'SORTI' },
  context: StageContext,
): Promise<ComputedCatchUpLock> {
  if (computedStageOf(profile, context).reason === 'SORTI') return NO_LOCK;
  const obligations = await db.catchUpObligation.findMany({
    where: { scoutProfileId: profile.id },
    select: {
      moduleId: true,
      decision: true,
      dueOn: true,
      module: {
        select: {
          publishedVersionId: true,
          publishedVersion: { select: { obligation: true, category: true, stageId: true } },
        },
      },
      originStage: true,
    },
  });
  if (obligations.length === 0) return NO_LOCK;
  const stillRequired = (row: (typeof obligations)[number]) => {
    const version = row.module.publishedVersion;
    // Même critère que `stillRequiredModuleWhere` : module obligatoire d'étape, version publiée.
    return (
      version?.obligation === 'OBLIGATOIRE' &&
      version.category === 'ETAPE' &&
      version.stageId !== null
    );
  };
  const ended = endedStages(
    profile.birthDate && iso(profile.birthDate),
    context.rules,
    context.today,
  );
  const candidates = obligations.filter(
    (row) => row.decision === null && stillRequired(row) && ended.has(row.originStage.code),
  );
  if (candidates.length === 0) return NO_LOCK;
  const accepted = await db.evaluationAttempt.findMany({
    where: {
      scoutProfileId: profile.id,
      status: 'VALIDEE',
      evaluation: { moduleId: { in: candidates.map((row) => row.moduleId) } },
    },
    select: { evaluation: { select: { moduleId: true } } },
  });
  const done = new Set(accepted.map((row) => row.evaluation.moduleId));
  const blocking = candidates.filter((row) => !done.has(row.moduleId));
  if (blocking.length === 0) return NO_LOCK;

  const current = blocking.reduce((first, row) =>
    row.originStage.position < first.originStage.position ? row : first,
  ).originStage;
  const allowed = new Set(
    obligations
      .filter((row) => row.originStage.position <= current.position)
      .map((row) => row.moduleId),
  );
  // Textes cités par les modules ouverts : nécessaires à leur étude.
  const versionIds = obligations
    .filter((row) => allowed.has(row.moduleId) && row.module.publishedVersionId)
    .map((row) => row.module.publishedVersionId!);
  if (versionIds.length > 0) {
    const links = await db.moduleTextLink.findMany({
      where: { versionId: { in: versionIds } },
      select: { textModuleId: true },
    });
    for (const link of links) allowed.add(link.textModuleId);
  }
  const dues = blocking
    .filter((row) => row.originStage.id === current.id && row.dueOn)
    .map((row) => iso(row.dueOn!))
    .sort(compareCivilDates);
  return {
    active: true,
    stage: current,
    dueOn: dues[0] ?? null,
    allowedModuleIds: allowed,
    blockingModuleIds: new Set(blocking.map((row) => row.moduleId)),
  };
}

/** Verrou du routier connecté (profil rattaché au compte) ; aucun pour l'encadrement. */
export async function loadActorCatchUpLock(
  db: LockReader,
  actor: { role: string; userId: string },
  context: StageContext,
): Promise<ComputedCatchUpLock> {
  if (actor.role !== 'ROUTIER') return NO_LOCK;
  const profile = await db.scoutProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, birthDate: true, membershipStatus: true },
  });
  return profile ? loadCatchUpLock(db, profile, context) : NO_LOCK;
}
