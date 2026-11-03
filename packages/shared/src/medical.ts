import { z } from 'zod';

/**
 * Fiche médicale personnelle (D135–D137). Une fiche par compte, quelle que soit la fonction du
 * titulaire (routier, encadrement, administrateur) ; seul le titulaire la lit, la modifie, l'imprime
 * ou la supprime. Toutes les informations de santé sont facultatives et déclarées volontairement :
 * aucun champ obligatoire tant que la communauté n'a pas validé le formulaire.
 * Jamais conservée hors ligne, jamais dans les statistiques ni dans le journal d'audit.
 */

/** Finalité affichée au titulaire avant la saisie. */
export const MEDICAL_RECORD_PURPOSE =
  'Ces informations servent uniquement à vous porter secours ou à adapter une activité. ' +
  'Elles sont facultatives, visibles par vous seul et modifiables ou supprimables à tout moment.';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères au maximum.` })
    .default('');

const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: 'Ce champ est requis.' })
    .max(max, { error: `${max} caractères au maximum.` });

/** Téléphone : chiffres, espaces, « + », points, tirets et parenthèses ; 6 à 20 chiffres. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{6,30}$/, { error: 'Numéro de téléphone invalide.' })
  .refine((value) => {
    const digits = value.replace(/\D/g, '').length;
    return digits >= 6 && digits <= 20;
  }, 'Numéro de téléphone invalide.');

export const emergencyContactSchema = z.object({
  name: requiredText(100),
  relation: requiredText(60),
  phone: phoneSchema,
});

export type EmergencyContact = z.infer<typeof emergencyContactSchema>;

export const MEDICAL_CONTACTS_MAX = 2;

/** Contenu chiffré de la fiche. Schéma strict : un champ inconnu est refusé. */
export const medicalRecordDataSchema = z
  .object({
    /** Coordonnées personnelles du titulaire. */
    phone: z.union([z.literal(''), phoneSchema]).default(''),
    emergencyContacts: z
      .array(emergencyContactSchema)
      .max(MEDICAL_CONTACTS_MAX, { error: `${MEDICAL_CONTACTS_MAX} contacts au maximum.` })
      .default([]),
    allergies: optionalText(1000),
    treatments: optionalText(1000),
    emergencyInstructions: optionalText(1000),
    precautions: optionalText(1000),
    /** Personne ou professionnel de santé à contacter si nécessaire. */
    healthContact: optionalText(300),
  })
  .strict();

export type MedicalRecordData = z.infer<typeof medicalRecordDataSchema>;
export type MedicalRecordDataInput = z.input<typeof medicalRecordDataSchema>;

export const MEDICAL_FIELD_LABELS = {
  phone: 'Téléphone personnel',
  emergencyContacts: 'Contacts d’urgence',
  allergies: 'Allergies déclarées',
  treatments: 'Traitements importants signalés',
  emergencyInstructions: 'Informations utiles en cas d’urgence',
  precautions: 'Restrictions ou précautions pour les activités',
  healthContact: 'Personne ou professionnel de santé à contacter',
} as const satisfies Record<keyof MedicalRecordData, string>;

/**
 * Aide à la saisie de chaque champ (exemples tirés de la fiche de liaison médicale de la région) :
 * oriente sans ajouter de case à cocher ni de donnée supplémentaire.
 */
export const MEDICAL_FIELD_HINTS = {
  phone: 'Numéro où vous joindre pendant une activité.',
  emergencyContacts: 'Deux personnes au plus, joignables pendant les activités.',
  allergies: 'À des médicaments, des aliments, des matières… et la réaction à surveiller.',
  treatments: 'Pour chaque médicament : nom, raison et posologie.',
  emergencyInstructions:
    'Maladie à connaître des secours (asthme, diabète, épilepsie, affection cardiaque…) et conduite à tenir.',
  precautions: 'Natation, effort prolongé, chaleur, régime alimentaire…',
  healthContact: 'Médecin traitant ou autre personne, avec son numéro.',
} as const satisfies Record<keyof MedicalRecordData, string>;

/**
 * Les quatre sections de la fiche, dans l'ordre du formulaire et du PDF. Les informations
 * personnelles (nom, naissance, matricule, équipe) viennent du compte : seul le téléphone est saisi.
 */
export const MEDICAL_RECORD_SECTIONS = [
  { key: 'personal', title: 'Informations personnelles', fields: ['phone'] },
  { key: 'contacts', title: 'Contacts d’urgence', fields: ['emergencyContacts', 'healthContact'] },
  { key: 'health', title: 'Informations de santé', fields: ['allergies', 'treatments'] },
  {
    key: 'instructions',
    title: 'Consignes complémentaires',
    fields: ['emergencyInstructions', 'precautions'],
  },
] as const satisfies readonly {
  key: string;
  title: string;
  fields: readonly (keyof MedicalRecordData)[];
}[];

/**
 * Enregistrement : `expectedRevision` null pour une création, sinon la révision lue (conflit 409
 * `MEDICAL_RECORD_CHANGED` si la fiche a changé entre-temps, par exemple depuis un autre appareil).
 */
export const saveMedicalRecordInputSchema = z.object({
  expectedRevision: z.number().int().positive().nullable(),
  data: medicalRecordDataSchema,
});

export type SaveMedicalRecordInput = z.input<typeof saveMedicalRecordInputSchema>;

export const deleteMedicalRecordInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
});

export type DeleteMedicalRecordInput = z.input<typeof deleteMedicalRecordInputSchema>;

/** Identité du titulaire, lue depuis le compte et la fiche routier (jamais recopiée). */
export const medicalHolderSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.iso.date().nullable(),
  matricule: z.string().nullable(),
  team: z.string().nullable(),
});

export type MedicalHolder = z.infer<typeof medicalHolderSchema>;

export const medicalRecordSchema = z.object({
  holder: medicalHolderSchema,
  record: z
    .object({
      data: medicalRecordDataSchema,
      revision: z.number().int().positive(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
});

export type MedicalRecord = z.infer<typeof medicalRecordSchema>;
