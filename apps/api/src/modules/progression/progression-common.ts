import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  type CompetencyValidation,
  type Evidence,
  EVIDENCE_KIND_LABELS,
  formatModuleCode,
  type ModuleStudy,
  type ScoutRef,
  type StageChange,
  STUDY_MODE_LABELS,
} from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';

export { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';

export function scoutProfileNotLinked(): NotFoundException {
  return new NotFoundException({
    code: 'SCOUT_PROFILE_NOT_LINKED',
    message: 'Votre compte n’est pas encore rattaché à une fiche routier.',
  });
}

export function revisionConflict(): ConflictException {
  return new ConflictException({
    code: 'EDIT_CONFLICT',
    message: 'Ces données ont été modifiées entre-temps. Rechargez la page avant de recommencer.',
  });
}

/** Équipe actuelle d'un routier (affectation ouverte). */
export const scoutRefInclude = {
  teamAssignments: { where: { endedAt: null }, include: { team: true }, take: 1 },
} as const satisfies Prisma.ScoutProfileInclude;

type ScoutRefRow = Prisma.ScoutProfileGetPayload<{ include: typeof scoutRefInclude }>;

export function toScoutRef(row: ScoutRefRow): ScoutRef {
  const team = row.teamAssignments[0]?.team ?? null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    matricule: row.matricule,
    team: team && { id: team.id, name: team.name },
  };
}

/** Code et titre d'affichage d'un module (version publiée, à défaut la plus récente). */
export const moduleRefSelect = {
  select: {
    id: true,
    number: true,
    slug: true,
    publishedVersion: { select: { title: true } },
    versions: { orderBy: { version: 'desc' }, take: 1, select: { title: true } },
  },
} as const satisfies { select: Prisma.PedagogicalModuleSelect };

type ModuleRefRow = Prisma.PedagogicalModuleGetPayload<typeof moduleRefSelect>;

export function toModuleRef(row: ModuleRefRow): { id: string; code: string; title: string } {
  return {
    id: row.id,
    code: formatModuleCode(row.number),
    title: row.publishedVersion?.title ?? row.versions[0]?.title ?? row.slug,
  };
}

export const stageChangeInclude = {
  fromStage: true,
  toStage: true,
  decidedBy: userSummarySelect,
  correctedBy: { select: { id: true } },
} as const satisfies Prisma.ScoutStageChangeInclude;

type StageChangeRow = Prisma.ScoutStageChangeGetPayload<{ include: typeof stageChangeInclude }>;

export function toStageChange(row: StageChangeRow): StageChange {
  return {
    id: row.id,
    kind: row.kind,
    from: toStageSummary(row.fromStage),
    to: toStageSummary(row.toStage),
    effectiveOn: toIsoDate(row.effectiveOn),
    decidedAt: row.decidedAt.toISOString(),
    decidedBy: toUserSummary(row.decidedBy),
    reason: row.reason,
    observations: row.observations,
    evidence: row.evidence,
    ceremonyReference: row.ceremonyReference,
    correctsChangeId: row.correctsChangeId,
    correctedByChangeId: row.correctedBy?.id ?? null,
  };
}

export const validationInclude = {
  competency: { select: { id: true, code: true, name: true } },
  decidedBy: userSummarySelect,
  revokedBy: userSummarySelect,
} as const satisfies Prisma.CompetencyValidationInclude;

type ValidationRow = Prisma.CompetencyValidationGetPayload<{ include: typeof validationInclude }>;

export function toValidation(row: ValidationRow): CompetencyValidation {
  return {
    id: row.id,
    competency: row.competency,
    decision: row.decision,
    justification: row.justification,
    decidedBy: toUserSummary(row.decidedBy)!,
    decidedAt: row.decidedAt.toISOString(),
    proposalId: row.proposalId,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedBy: toUserSummary(row.revokedBy),
    revocationReason: row.revocationReason,
  };
}

export const moduleStudyInclude = {
  module: moduleRefSelect,
  moduleVersion: { select: { version: true } },
  activity: { select: { id: true, title: true } },
  recordedBy: userSummarySelect,
  scoutProfile: { select: { userId: true } },
} as const satisfies Prisma.ModuleStudyInclude;

type ModuleStudyRow = Prisma.ModuleStudyGetPayload<{ include: typeof moduleStudyInclude }>;

export function toModuleStudy(row: ModuleStudyRow): ModuleStudy {
  return {
    id: row.id,
    module: toModuleRef(row.module),
    moduleVersion: row.moduleVersion?.version ?? null,
    mode: row.mode,
    studiedOn: toIsoDate(row.studiedOn),
    activity: row.activity,
    observation: row.observation,
    recordedBy: toUserSummary(row.recordedBy)!,
    selfDeclared: row.scoutProfile.userId !== null && row.scoutProfile.userId === row.recordedById,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Données nécessaires à la description d'un élément justificatif (jamais le contenu d'une observation). */
export const evidenceInclude = {
  addedBy: userSummarySelect,
  observation: { select: { id: true, observedOn: true, category: true } },
  attempt: {
    select: {
      id: true,
      code: true,
      status: true,
      mode: true,
      score: true,
      maxScore: true,
      evaluation: { select: { title: true } },
    },
  },
  activity: { select: { id: true, title: true, plannedOn: true, heldOn: true } },
  moduleStudy: {
    select: { id: true, mode: true, studiedOn: true, module: moduleRefSelect },
  },
} as const satisfies Prisma.CompetencyEvidenceInclude;

type EvidenceRow = Prisma.CompetencyEvidenceGetPayload<{ include: typeof evidenceInclude }>;

const scoreFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Libellé lisible et référence interne d'un élément justificatif. */
export function describeEvidence(row: EvidenceRow): Pick<Evidence, 'label' | 'reference'> {
  if (row.observation) {
    const { observedOn, category } = row.observation;
    return {
      label: `Observation du ${toIsoDate(observedOn)}${category ? ` (${category})` : ''}`,
      reference: null,
    };
  }
  if (row.attempt) {
    const { code, evaluation, score, maxScore, status } = row.attempt;
    const result =
      score !== null && maxScore !== null
        ? ` — ${scoreFormatter.format(Number(score))} / ${scoreFormatter.format(Number(maxScore))}`
        : '';
    return { label: `${evaluation.title} (${code}, ${status})${result}`, reference: code };
  }
  if (row.activity) {
    const date = row.activity.heldOn ?? row.activity.plannedOn;
    return {
      label: `${row.activity.title} — ${toIsoDate(date)}`,
      reference: `/administration/activites/${row.activity.id}`,
    };
  }
  if (row.moduleStudy) {
    const module = toModuleRef(row.moduleStudy.module);
    return {
      label: `${module.code} ${module.title} — ${STUDY_MODE_LABELS[row.moduleStudy.mode]}, ${toIsoDate(row.moduleStudy.studiedOn)}`,
      reference: null,
    };
  }
  return { label: row.description ?? EVIDENCE_KIND_LABELS[row.kind], reference: null };
}

export function toEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    kind: row.kind,
    ...describeEvidence(row),
    addedBy: toUserSummary(row.addedBy)!,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Date du jour (UTC = heure d'Abidjan) au format AAAA-MM-JJ. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoToDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
