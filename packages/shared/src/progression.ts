/**
 * Étapes de progression de la Branche Route (référentiel SAPF-Route).
 * Les durées dépendent de l'âge et restent à arbitrer : elles ne sont pas codées ici.
 */
export const PROGRESSION_STAGES = [
  {
    code: 'NOVICIAT',
    order: 1,
    name: 'Noviciat',
    programmeLabel: 'Novices Routiers',
    badge: 'Flot gris',
  },
  {
    code: 'APPRENTISSAGE',
    order: 2,
    name: 'Apprentissage',
    programmeLabel: 'Aspirants Routiers',
    badge: 'Flot marron',
  },
  {
    code: 'COMPAGNONNAGE',
    order: 3,
    name: 'Compagnonnage',
    programmeLabel: 'Compagnons Routiers',
    badge: 'Flot routier',
  },
  {
    code: 'DEPART_ROUTIER',
    order: 4,
    name: 'Départ routier',
    programmeLabel: 'Routiers Confirmés',
    badge: 'Étoile or',
  },
] as const;

export type ProgressionStageCode = (typeof PROGRESSION_STAGES)[number]['code'];
