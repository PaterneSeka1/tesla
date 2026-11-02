import { z } from 'zod';

/**
 * Référentiel de l'Entreprise routière (D158–D160).
 *
 * - Les dix domaines d'action sont ceux du manuel « SAPF-Route » (p. 6 à 8) et du « Guide de
 *   l'Entreprise » Nikola Tesla 2026–2027 (p. 8). Les listes à cinq ou sept domaines des anciens
 *   supports (fiche technique n° 7) sont historiques : elles ne créent aucune catégorie. Les domaines
 *   sont traités dans un seul module (`NT-ROUTE-M10`, une leçon par domaine) : ni module, ni étape, ni
 *   espace propre.
 * - Les fiches pratiques reprennent les tableaux et annexes du Guide : modèles vierges imprimables,
 *   sans aucun projet ni donnée personnelle. Elles sont rattachées au module `NT-ROUTE-M09` et
 *   rendues en PDF par l'API, au même titre que le support de cours.
 */

export const ACTION_DOMAINS = [
  'Santé et sport',
  'Développement social',
  'Éducation à la paix',
  'Environnement',
  'Éducation sexuelle',
  'Agro-pastorale',
  'Vie et foi',
  'Art et culture',
  'Éducation et protection de l’enfance',
  'Technologies de l’information et de la communication',
] as const;

export type ActionDomain = (typeof ACTION_DOMAINS)[number];

/** Module de référence des domaines d'action (code source stable). */
export const ACTION_DOMAINS_MODULE_KEY = 'NT-ROUTE-M10';
/** Module de l'Entreprise routière, auquel sont rattachées les fiches pratiques. */
export const ENTREPRISE_MODULE_KEY = 'NT-ROUTE-M09';

// ─── Fiches pratiques ─────────────────────────────────────────────────────

export type PracticalSheetBlock =
  /** Rubriques à renseigner : libellé, indication facultative, zone d'écriture. */
  | { kind: 'fields'; title?: string; rows: { label: string; hint?: string; lines?: number }[] }
  /** Tableau : lignes préremplies (première colonne), lignes vierges, ligne de total facultative. */
  | {
      kind: 'table';
      title?: string;
      columns: string[];
      /** Largeurs relatives des colonnes (même longueur que `columns`). */
      widths?: number[];
      rows?: string[][];
      blankRows?: number;
      total?: string;
    }
  | { kind: 'checklist'; title?: string; items: string[] }
  | { kind: 'text'; text: string };

export interface PracticalSheet {
  key: string;
  title: string;
  /** Usage de la fiche, affiché dans la liste et en tête du PDF. */
  purpose: string;
  /** Source documentaire du modèle. */
  source: string;
  blocks: PracticalSheetBlock[];
}

const GUIDE = 'Guide de l’Entreprise, Communauté Nikola Tesla, édition 2026–2027';

const SEVEN_DIMENSIONS = [
  'Vie en équipe et coresponsabilité',
  'Ouverture au monde et écoute des populations',
  'Découverte de soi et progression personnelle',
  'Action concrète au sein de la société',
  'Esprit de service et engagement',
  'Respect de la nature et des ressources',
  'Collaboration avec des partenaires adaptés',
];

export const PRACTICAL_SHEETS: readonly PracticalSheet[] = [
  {
    key: 'grille-selection',
    title: 'Grille de comparaison des projets',
    purpose:
      'Comparer plusieurs idées d’Entreprise après l’observation du terrain, avant la délibération et le vote.',
    source: `${GUIDE}, annexe A`,
    blocks: [
      {
        kind: 'text',
        text: 'Chaque critère est noté de 0 à 5. Chaque routier exprime son avis ; la grille éclaire la délibération, le choix reste collectif et il est consigné dans le procès-verbal.',
      },
      {
        kind: 'fields',
        rows: [{ label: 'Projet A' }, { label: 'Projet B' }, { label: 'Projet C' }],
      },
      {
        kind: 'table',
        columns: ['Critère', 'Projet A', 'Projet B', 'Projet C'],
        widths: [3, 1, 1, 1],
        rows: [
          ['Besoin réel établi', '/5', '/5', '/5'],
          ['Participation des bénéficiaires', '/5', '/5', '/5'],
          ['Impact social ou éducatif', '/5', '/5', '/5'],
          ['Faisabilité et sécurité', '/5', '/5', '/5'],
          ['Mobilisation possible de l’équipe', '/5', '/5', '/5'],
          ['Durabilité de l’action', '/5', '/5', '/5'],
        ],
        total: 'TOTAL (sur 30)',
      },
      {
        kind: 'fields',
        title: 'Observations',
        rows: [
          { label: 'Points forts relevés', lines: 2 },
          { label: 'Difficultés relevées', lines: 2 },
        ],
      },
    ],
  },
  {
    key: 'proces-verbal',
    title: 'Procès-verbal de choix de l’Entreprise',
    purpose:
      'Consigner la délibération et le vote par lesquels la communauté choisit son Entreprise.',
    source: `${GUIDE}, p. 2 et annexe A (contenu proposé)`,
    blocks: [
      {
        kind: 'fields',
        title: 'Réunion',
        rows: [
          { label: 'Date et lieu' },
          { label: 'Nombre de routiers présents' },
          { label: 'Animation de la séance' },
          { label: 'Secrétaire (rapporteur)' },
          { label: 'Coordinateur présent', hint: 'accompagnateur pédagogique' },
        ],
      },
      {
        kind: 'table',
        title: 'Projets présentés',
        columns: ['Projet', 'Domaine principal', 'Total grille /30', 'Voix'],
        widths: [3, 2, 1, 1],
        blankRows: 3,
      },
      {
        kind: 'fields',
        title: 'Décision',
        rows: [
          { label: 'Projet retenu' },
          { label: 'Domaine principal' },
          { label: 'Domaines complémentaires et justification', lines: 2 },
          { label: 'Principaux arguments échangés', lines: 3 },
          { label: 'Engagements pris par les routiers', lines: 2 },
          { label: 'Prochaines étapes et échéances', lines: 2 },
        ],
      },
      {
        kind: 'fields',
        title: 'Signatures',
        rows: [{ label: 'Secrétaire (rapporteur)' }, { label: 'Coordination opérationnelle' }],
      },
    ],
  },
  {
    key: 'fiche-resume',
    title: 'Fiche résumé de l’Entreprise',
    purpose:
      'Présenter l’essentiel du projet sur une page, placée juste après la page de garde du dossier.',
    source: `${GUIDE}, p. 3`,
    blocks: [
      {
        kind: 'fields',
        rows: [
          { label: 'Titre', hint: 'le problème et la réponse proposée, en quelques mots' },
          { label: 'Porteurs', hint: 'équipe ou communauté ; référent de projet' },
          {
            label: 'Problème constaté',
            hint: 'besoin confirmé avec les personnes concernées',
            lines: 2,
          },
          {
            label: 'Objectif global',
            hint: 'amélioration recherchée à l’issue du projet',
            lines: 2,
          },
          { label: 'Domaine principal et domaines complémentaires' },
          {
            label: 'Bénéficiaires',
            hint: 'catégories, effectif estimé, critères de choix',
            lines: 2,
          },
          {
            label: 'Site et calendrier',
            hint: 'lieu ; dates de début, de réalisation et de bilan',
          },
          {
            label: 'Partenaires',
            hint: 'confirmés et sollicités, contributions prévues',
            lines: 2,
          },
          { label: 'Budget', hint: 'total ; ressources acquises ; financement restant' },
          {
            label: 'Résultats vérifiables',
            hint: '2 à 4 résultats observables et mesurables',
            lines: 3,
          },
        ],
      },
    ],
  },
  {
    key: 'chronogramme',
    title: 'Modèle de chronogramme',
    purpose:
      'Planifier les étapes de l’Entreprise, leurs responsables et la preuve attendue à chaque étape.',
    source: `${GUIDE}, p. 4 et 6`,
    blocks: [
      {
        kind: 'table',
        columns: ['Étape', 'Période', 'Responsable', 'Preuve attendue'],
        widths: [2, 1.4, 1.4, 2],
        rows: [
          ['Diagnostic', '', '', 'État des lieux'],
          ['Validation du projet', '', '', 'Compte rendu'],
          ['Mobilisation des ressources', '', '', 'Accords, devis'],
          ['Collecte et achats', '', '', 'Devis, reçus'],
          ['Réalisation', '', '', 'Fiche de suivi d’exécution'],
          ['Évaluation et bilan', '', '', 'Bilan signé'],
        ],
        blankRows: 4,
      },
      {
        kind: 'text',
        text: 'Tenir compte du calendrier scout et de la disponibilité des bénéficiaires. Pour la réalisation, détailler le programme d’activités avec les dates et, si possible, les heures.',
      },
    ],
  },
  {
    key: 'budget',
    title: 'Tableau de budget prévisionnel',
    purpose: 'Estimer les dépenses à partir des quantités, des prix unitaires et des devis.',
    source: `${GUIDE}, p. 7 ; Méthodologie Entreprise (fiche technique n° 7), p. 6`,
    blocks: [
      {
        kind: 'text',
        text: 'Montant = quantité × prix unitaire. Nature : I = investissement (matériel durable, construction, équipement utilisé plus d’un an) ; F = fonctionnement (transport, consommables, communication, restauration, frais courants). Joindre un devis ou un justificatif par ligne lorsque c’est possible.',
      },
      {
        kind: 'table',
        columns: ['Poste', 'I / F', 'Qté', 'Prix unit.', 'Montant (FCFA)', 'Justificatif'],
        widths: [3, 0.7, 0.7, 1.2, 1.5, 1.4],
        rows: [
          ['Matériel et équipements'],
          ['Consommables'],
          ['Transport / logistique'],
          ['Communication'],
          ['Autres charges justifiées'],
        ],
        blankRows: 5,
        total: 'TOTAL',
      },
    ],
  },
  {
    key: 'financement',
    title: 'Tableau de financement',
    purpose:
      'Distinguer les ressources prévues des ressources réellement acquises, et suivre chaque engagement.',
    source: `${GUIDE}, p. 7`,
    blocks: [
      {
        kind: 'table',
        columns: ['Source', 'Montant prévu', 'Montant acquis', 'Pièce (accord, reçu)'],
        widths: [3, 1.3, 1.3, 1.6],
        rows: [['Apport des routiers'], ['Activités d’autofinancement'], ['Dons et partenariats']],
        blankRows: 3,
        total: 'TOTAL financier',
      },
      {
        kind: 'table',
        title: 'Contributions en nature (valorisées à part)',
        columns: ['Contribution', 'Apportée par', 'Valeur estimée', 'Confirmée ?'],
        widths: [3, 1.6, 1.3, 1.3],
        rows: [['Prêt de matériel'], ['Transport'], ['Temps de bénévolat']],
        blankRows: 2,
      },
      {
        kind: 'text',
        text: 'Aucun financement incertain n’est compté comme acquis. Repère historique : l’ancienne méthodologie demandait un apport personnel au moins égal au tiers du budget ; ce seuil est à vérifier auprès de l’encadrement avant d’être appliqué.',
      },
    ],
  },
  {
    key: 'suivi-execution',
    title: 'Fiche de suivi d’exécution',
    purpose:
      'Suivre l’avancement des actions et des dépenses pendant la réalisation, et signaler les obstacles.',
    source: `${GUIDE}, annexe B et p. 7`,
    blocks: [
      {
        kind: 'table',
        title: 'Actions',
        columns: ['Action', 'Responsable', 'Échéance', 'État / obstacle'],
        widths: [3, 1.4, 1.1, 2.2],
        blankRows: 8,
      },
      {
        kind: 'table',
        title: 'Dépenses',
        columns: ['Date', 'Objet', 'Prévu', 'Réel', 'Justificatif n°'],
        widths: [1, 3, 1.1, 1.1, 1.3],
        blankRows: 8,
        total: 'TOTAL',
      },
    ],
  },
  {
    key: 'bilan',
    title: 'Grille de bilan de l’Entreprise',
    purpose:
      'Comparer les résultats aux objectifs, établir le bilan financier et relire ce que l’Entreprise a fait grandir.',
    source: `${GUIDE}, p. 2 et 7`,
    blocks: [
      {
        kind: 'table',
        title: 'Objectifs et résultats',
        columns: ['Objectif spécifique', 'Indicateur', 'Résultat obtenu', 'Atteint ?'],
        widths: [2.4, 1.8, 1.8, 1],
        blankRows: 4,
      },
      {
        kind: 'fields',
        title: 'Bilan financier',
        rows: [
          { label: 'Budget prévu' },
          { label: 'Dépenses réelles' },
          { label: 'Écart et explication', lines: 2 },
          { label: 'Justificatifs classés', hint: 'oui / non, emplacement' },
        ],
      },
      {
        kind: 'fields',
        title: 'Relecture',
        rows: [
          { label: 'Avis des bénéficiaires', lines: 2 },
          { label: 'Difficultés rencontrées et réponses apportées', lines: 2 },
          { label: 'Continuité : qui entretient ou poursuit ?', lines: 2 },
          { label: 'Ce que nous transmettons à la prochaine équipe', lines: 2 },
        ],
      },
      {
        kind: 'table',
        title: 'Les sept dimensions éducatives',
        columns: ['Dimension', 'Ce que nous avons vécu'],
        widths: [2.2, 4],
        rows: SEVEN_DIMENSIONS.map((dimension) => [dimension]),
      },
    ],
  },
  {
    key: 'checklist-lancement',
    title: 'Checklist avant lancement',
    purpose:
      'Vérifier, avant de commencer la réalisation, que les conditions essentielles sont réunies.',
    source: `${GUIDE}, annexe C`,
    blocks: [
      {
        kind: 'checklist',
        items: [
          'Le besoin est confirmé par les bénéficiaires.',
          'Les rôles et tâches sont acceptés.',
          'Le dossier et le calendrier sont validés.',
          'Les autorisations sont réunies.',
          'Le budget est réaliste et les dépenses traçables.',
          'Les risques et la protection des participants sont pris en compte.',
          'Les modalités de suivi, de réception et d’entretien sont définies.',
        ],
      },
      {
        kind: 'fields',
        rows: [
          { label: 'Vérifié le' },
          { label: 'Par (coordination)' },
          { label: 'Observations', lines: 3 },
        ],
      },
    ],
  },
];

export const PRACTICAL_SHEET_KEYS = PRACTICAL_SHEETS.map((sheet) => sheet.key);

export const practicalSheetSummarySchema = z.object({
  key: z.string(),
  title: z.string(),
  purpose: z.string(),
});

export type PracticalSheetSummary = z.infer<typeof practicalSheetSummarySchema>;

/** Fiches rattachées à un module (par son code source) ; aucune pour les autres modules. */
export function practicalSheetsFor(sourceKey: string | null | undefined): PracticalSheetSummary[] {
  if (sourceKey !== ENTREPRISE_MODULE_KEY) return [];
  return PRACTICAL_SHEETS.map(({ key, title, purpose }) => ({ key, title, purpose }));
}
