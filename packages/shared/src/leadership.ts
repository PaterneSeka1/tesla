import { z } from 'zod';
import { userSummarySchema } from './api.js';
import { DELEGABLE_PERMISSIONS } from './permissions.js';
import { LEADER_FUNCTIONS, LEGACY_ROLES } from './roles.js';

// Encadrement : années scoutes, mandats annuels, délégations (docs/FEATURES/MANDATS_RESPONSABLES.md).

const calendarDate = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, { error: `${label} est obligatoire (${min} caractères au minimum).` })
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/** Synchronisé avec l'enum Prisma `MandateKind`. */
export const MANDATE_KINDS = [
  'NOMINATION',
  'RECONDUCTION',
  'REMPLACEMENT',
  'CHANGEMENT_FONCTION',
] as const;

export type MandateKind = (typeof MANDATE_KINDS)[number];

export const MANDATE_KIND_LABELS: Record<MandateKind, string> = {
  NOMINATION: 'Nomination',
  RECONDUCTION: 'Reconduction',
  REMPLACEMENT: 'Remplacement',
  CHANGEMENT_FONCTION: 'Changement de fonction',
};

// ─── Années scoutes ─────────────────────────────────────────────────────────

export const scoutYearSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  startsOn: z.iso.date(),
  /** Dernier jour inclus. */
  endsOn: z.iso.date(),
});

export type ScoutYear = z.infer<typeof scoutYearSchema>;

export const createScoutYearInputSchema = z
  .object({
    label: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, { error: 'Libellé attendu : AAAA-AAAA.' }),
    startsOn: calendarDate,
    endsOn: calendarDate,
  })
  .refine((v) => Number(v.label.slice(5)) === Number(v.label.slice(0, 4)) + 1, {
    error: 'Les deux années du libellé doivent se suivre (ex. 2026-2027).',
    path: ['label'],
  })
  .refine((v) => v.endsOn > v.startsOn, {
    error: 'La fin doit suivre le début.',
    path: ['endsOn'],
  });

export type CreateScoutYearInput = z.input<typeof createScoutYearInputSchema>;

// ─── Mandats ────────────────────────────────────────────────────────────────

export const mandateSchema = z.object({
  id: z.uuid(),
  user: userSummarySchema,
  function: z.enum(LEADER_FUNCTIONS),
  scoutYear: z.object({ id: z.uuid(), label: z.string() }),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  endedEarlyOn: z.iso.date().nullable(),
  endReason: z.string().nullable(),
  /** Dernier jour effectivement exercé (fin anticipée ou fin prévue). */
  effectiveEndOn: z.iso.date(),
  kind: z.enum(MANDATE_KINDS),
  appointingAuthority: z.string(),
  appointmentReference: z.string().nullable(),
  previousMandateId: z.uuid().nullable(),
  notes: z.string().nullable(),
  recordedBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  /** En vigueur à la date du jour (Abidjan). */
  active: z.boolean(),
});

export type Mandate = z.infer<typeof mandateSchema>;

/**
 * Enregistrement d'un mandat. La nomination elle-même est décidée par l'autorité indiquée ;
 * la plateforme la consigne. Confirmation explicite obligatoire (aucune reconduction implicite).
 */
export const recordMandateInputSchema = z.object({
  userId: z.uuid({ error: 'Choisissez la personne.' }),
  function: z.enum(LEADER_FUNCTIONS, { error: 'Choisissez la fonction.' }),
  scoutYearId: z.uuid({ error: 'Choisissez l’année scoute.' }),
  /** Par défaut : bornes de l'année scoute. */
  startsOn: calendarDate.optional(),
  endsOn: calendarDate.optional(),
  kind: z.enum(MANDATE_KINDS),
  appointingAuthority: requiredText(3, 300, 'L’autorité de nomination'),
  appointmentReference: optionalText(300),
  previousMandateId: z.uuid().nullable().optional(),
  notes: optionalText(3000),
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type RecordMandateInput = z.input<typeof recordMandateInputSchema>;

export const endMandateInputSchema = z.object({
  /** Dernier jour exercé. */
  endedEarlyOn: calendarDate,
  reason: requiredText(3, 2000, 'Le motif'),
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type EndMandateInput = z.input<typeof endMandateInputSchema>;

/** Préremplissage d'une reconduction : jamais enregistré sans confirmation explicite. */
export const reconductionDraftSchema = z.object({
  previousMandate: mandateSchema,
  nextScoutYear: scoutYearSchema.nullable(),
  draft: z.object({
    userId: z.uuid(),
    function: z.enum(LEADER_FUNCTIONS),
    scoutYearId: z.uuid().nullable(),
    startsOn: z.iso.date().nullable(),
    endsOn: z.iso.date().nullable(),
    kind: z.literal('RECONDUCTION'),
    previousMandateId: z.uuid(),
  }),
  /** Nombre de mandats successifs déjà exercés dans cette fonction (information, aucune limite). */
  consecutiveCount: z.number().int(),
});

export type ReconductionDraft = z.infer<typeof reconductionDraftSchema>;

// ─── Délégations ────────────────────────────────────────────────────────────

export const delegationSchema = z.object({
  id: z.uuid(),
  delegator: userSummarySchema,
  delegate: userSummarySchema,
  permissions: z.array(z.string()),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  reason: z.string(),
  revokedAt: z.iso.datetime().nullable(),
  revokeReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  active: z.boolean(),
});

export type Delegation = z.infer<typeof delegationSchema>;

export const createDelegationInputSchema = z
  .object({
    delegateId: z.uuid({ error: 'Choisissez le bénéficiaire.' }),
    permissions: z
      .array(z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]]))
      .min(1, { error: 'Choisissez au moins une permission.' })
      .max(DELEGABLE_PERMISSIONS.length),
    startsOn: calendarDate,
    endsOn: calendarDate,
    reason: requiredText(3, 2000, 'Le motif'),
    confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    error: 'La fin doit suivre le début.',
    path: ['endsOn'],
  });

export type CreateDelegationInput = z.input<typeof createDelegationInputSchema>;

export const revokeDelegationInputSchema = z.object({
  reason: requiredText(3, 2000, 'Le motif'),
});

export type RevokeDelegationInput = z.input<typeof revokeDelegationInputSchema>;

// ─── Vue d'ensemble ─────────────────────────────────────────────────────────

export const leadershipOverviewSchema = z.object({
  today: z.iso.date(),
  currentScoutYear: scoutYearSchema.nullable(),
  scoutYears: z.array(scoutYearSchema),
  /** Mandats en vigueur aujourd'hui. */
  current: z.array(mandateSchema),
  vacancies: z.object({ plein: z.boolean(), adjoint: z.boolean() }),
  /** Membres de l'encadrement sans mandat en vigueur (dont anciens comptes à résoudre). */
  withoutMandate: z.array(
    userSummarySchema.extend({ legacyRole: z.enum(LEGACY_ROLES).nullable() }),
  ),
  delegations: z.array(delegationSchema),
});

export type LeadershipOverview = z.infer<typeof leadershipOverviewSchema>;

export const mandateHistorySchema = z.object({ mandates: z.array(mandateSchema) });

export type MandateHistory = z.infer<typeof mandateHistorySchema>;
