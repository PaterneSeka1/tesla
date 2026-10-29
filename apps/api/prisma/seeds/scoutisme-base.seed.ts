/**
 * Modules pédagogiques issus du document « BASE DU SCOUTISME » (6 pages), découpés selon la proposition
 * `Nikola_Tesla_Modules_Scoutisme.md`. Le texte des leçons est repris tel quel de la source, coquilles
 * comprises : rien n'est corrigé ni complété silencieusement. Les points douteux et les manques sont
 * consignés dans les notes éditoriales (jamais transmises aux routiers). Une leçon sans développement
 * dans la source reste vide : la soumission du module est refusée tant qu'elle n'est pas rédigée.
 * Étapes et objectifs : propositions pédagogiques, jamais des conditions de progression.
 */
import { type LessonBlock, type LessonDocument, type SourceEditorialNote } from '@tesla/shared';
import { type SourceModule } from './source-modules.js';

const SOURCE_DOCUMENT = 'BASE DU SCOUTISME.pdf';
/** SHA-256 du PDF utilisé pour l'import (contrôle de la version du document). */
const SOURCE_SHA256 = 'cc40c92e6ddbcf61ab548018b0b6c6911a1514d1e20621e8b56523b43729b8d9';
const THEME = 'Bases du scoutisme';

// ─── Construction des documents (liste blanche de `lessonDocumentSchema`) ──

const paragraph = (text: string): LessonBlock => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const heading = (text: string): LessonBlock => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [{ type: 'text', text }],
});
const items = (texts: string[]) =>
  texts.map((text) => ({ type: 'listItem' as const, content: [paragraph(text)] }));
const bullets = (texts: string[]): LessonBlock => ({ type: 'bulletList', content: items(texts) });
const ordered = (texts: string[]): LessonBlock => ({ type: 'orderedList', content: items(texts) });
/** Référence de provenance affichée en fin de leçon. */
const sourceLine = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text: `Source : « Base du scoutisme », ${pages}.`,
      marks: [{ type: 'italic' }],
    },
  ],
});
const doc = (...content: LessonBlock[]): LessonDocument => ({ type: 'doc', content });
/** Leçon à rédiger : aucun contenu source disponible. */
const EMPTY = doc();

const note = (
  kind: SourceEditorialNote['kind'],
  lessonPosition: number | null,
  text: string,
): SourceEditorialNote => ({ kind, lessonPosition, note: text });

/** Notes communes à tous les modules importés. */
const commonNotes = (stage: string): SourceEditorialNote[] => [
  note(
    'INFORMATION',
    null,
    `Étape recommandée « ${stage} » : proposition pédagogique du document de découpage, pas une condition de progression. À confirmer par le responsable.`,
  ),
  note(
    'INFORMATION',
    null,
    'Objectifs repris du document de découpage (Nikola_Tesla_Modules_Scoutisme.md), à valider.',
  ),
  note(
    'A_COMPLETER',
    null,
    'Évaluation à préparer : la source ne contient aucune question. Aucun questionnaire n’a été créé ; les chefs le construiront selon le workflow d’approbation.',
  ),
];

const emptyLessonNote = (position: number, detail: string) =>
  note(
    'A_COMPLETER',
    position,
    `Leçon vide : ${detail} La soumission du module reste impossible tant qu’elle n’est pas rédigée.`,
  );

// ─── Alphabet Morse : transcription de l'illustration de la page 4 ─────────
// « · » = point, « — » = trait. Lettres A–Z puis chiffres 1–9 et 0, dans l'ordre de l'illustration.

export const MORSE_LETTERS: readonly (readonly [string, string])[] = [
  ['A', '· —'],
  ['B', '— · · ·'],
  ['C', '— · — ·'],
  ['D', '— · ·'],
  ['E', '·'],
  ['F', '· · — ·'],
  ['G', '— — ·'],
  ['H', '· · · ·'],
  ['I', '· ·'],
  ['J', '· — — —'],
  ['K', '— · —'],
  ['L', '· — · ·'],
  ['M', '— —'],
  ['N', '— ·'],
  ['O', '— — —'],
  ['P', '· — — ·'],
  ['Q', '— — · —'],
  ['R', '· — ·'],
  ['S', '· · ·'],
  ['T', '—'],
  ['U', '· · —'],
  ['V', '· · · —'],
  ['W', '· — —'],
  ['X', '— · · —'],
  ['Y', '— · — —'],
  ['Z', '— — · ·'],
];

export const MORSE_DIGITS: readonly (readonly [string, string])[] = [
  ['1', '· — — — —'],
  ['2', '· · — — —'],
  ['3', '· · · — —'],
  ['4', '· · · · —'],
  ['5', '· · · · ·'],
  ['6', '— · · · ·'],
  ['7', '— — · · ·'],
  ['8', '— — — · ·'],
  ['9', '— — — — ·'],
  ['0', '— — — — —'],
];

const morseList = (entries: readonly (readonly [string, string])[]) =>
  bullets(entries.map(([sign, code]) => `${sign} : ${code}`));

// ─── Modules ───────────────────────────────────────────────────────────────

const M01: SourceModule = {
  key: 'NT-SCOUT-M01',
  slug: 'nt-scout-m01-decouvrir-le-scoutisme',
  title: 'Découvrir le scoutisme',
  summary: 'Définition, objectifs, fondateur, emblème et grandes dates du scoutisme.',
  objectives: ['Expliquer le scoutisme, son objectif éducatif et situer des repères historiques.'],
  stageCode: 'NOVICIAT',
  theme: THEME,
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 1 à 3',
  lessons: [
    {
      title: 'Définition du scoutisme',
      content: doc(
        paragraph(
          'Le scoutisme est un mouvement éducatif pour les jeunes fondé sur le volontariat.',
        ),
        paragraph('C’est un mouvement apolitique sans distinction d’origine et de croyance.'),
        paragraph(
          'Pour son bon fonctionnement, le scoutisme utilise une méthode de fonctionnement appelé la méthode scout.',
        ),
        sourceLine('p. 1'),
      ),
    },
    {
      title: 'Objectifs du scoutisme',
      content: doc(
        paragraph(
          'Contribuer au développement des jeunes en les aidant à réaliser pleinement leurs possibilités physiques, intellectuel, spirituel et Social.',
        ),
        sourceLine('p. 2'),
      ),
    },
    {
      title: 'Robert Baden-Powell et les origines',
      content: doc(
        heading('Le fondateur du scoutisme'),
        paragraph(
          'Stephenson Smith Robert Baden Powell (BP) il est né le 22 février 1857 et décéda le 08 Janvier 1941. Épouse : Olave Sain Clair.',
        ),
        sourceLine('p. 1'),
      ),
    },
    {
      title: 'La fleur de lys et l’OMMS',
      content: doc(
        heading('L’emblème du Scoutisme'),
        paragraph('La Fleur de Lys.'),
        heading('OMMS'),
        paragraph('Organisation Mondiale du Mouvement Scout (Malaysi)'),
        sourceLine('p. 1'),
      ),
    },
    {
      title: 'Les grandes dates du scoutisme',
      content: doc(
        bullets([
          "1907 : Premier camp scout expérimental sur l'île de Brownsea (Royaume-Uni) par Robert Baden-Powell.",
          '1910 : Naissance du mouvement des Guides (filles).',
          '1916 : Naissance du Louvetisme.',
          '1918 : Création des Routiers (jeunes adultes).',
          '1920 : Premier Jamboree Mondial à Londres, marquant la reconnaissance internationale.',
          '1937 : Arrivé du scoutisme en Côte d’Ivoire à la paroisse sainte jeanne d’arc de Treichville par le révérend Père Paul Rey.',
        ]),
        sourceLine('p. 3'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    note(
      'A_VERIFIER',
      null,
      'Texte repris tel quel, coquilles comprises (« appelé la méthode scout », « intellectuel, spirituel et Social », « Arrivé ») : à relire avant soumission.',
    ),
    note(
      'A_VERIFIER',
      2,
      'Identité à vérifier : la source écrit « Stephenson Smith Robert Baden Powell » et « Olave Sain Clair ».',
    ),
    note(
      'A_COMPLETER',
      2,
      'Les origines du scoutisme ne sont pas développées dans la source (seul le camp de 1907 figure, dans la chronologie de la leçon 5).',
    ),
    note(
      'A_COMPLETER',
      3,
      'Signification de la fleur de lys et rôle de l’OMMS non développés dans la source.',
    ),
    note('A_VERIFIER', 3, 'Mention « (Malaysi) » à vérifier et à corriger.'),
    note(
      'A_VERIFIER',
      4,
      'Chronologie à confronter à une source de référence avant publication, en particulier l’entrée 1937 (date, paroisse, nom du prêtre), signalée « à vérifier » par le document de découpage.',
    ),
  ],
};

const M02: SourceModule = {
  key: 'NT-SCOUT-M02',
  slug: 'nt-scout-m02-loi-principes-et-vertus',
  title: 'Loi, principes et vertus',
  summary: 'Les trois principes, les trois vertus et les dix articles de la loi scoute.',
  objectives: [
    'Reconnaître les trois principes, les trois vertus et donner des exemples de mise en pratique de la loi.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 2',
  lessons: [
    {
      title: 'Les trois principes scouts',
      content: doc(
        paragraph('Il existe 3 principes :'),
        ordered([
          'Principe spirituel (Devoir envers DIEU)',
          'Principes Social (Devoir envers les autres)',
          'Principes Personnel (Devoir envers soi-même)',
        ]),
        sourceLine('p. 2'),
      ),
    },
    {
      title: 'Les trois vertus',
      content: doc(
        paragraph('Il existe 3 vertus :'),
        ordered(['Franchise', 'Dévouement', 'Pureté']),
        sourceLine('p. 2'),
      ),
    },
    {
      title: 'Les dix articles de la loi scoute',
      content: doc(
        ordered([
          'Le scout met son honneur à mériter confiance.',
          'Le scout est loyal à son pays, ses parents, ses chefs et ses subordonnés.',
          'Le scout est fait pour servir et sauver son prochain.',
          'Le scout est l’ami de tous et le frère de tout autre scout.',
          'Le scout est courtois et chevaleresque.',
          'Le scout voit dans la nature l’œuvre de Dieu, il aime les plantes et les animaux.',
          'Le scout obéit sans réplique et ne fait rien à moitié.',
          'Le scout est maître de soi, il sourit et chante dans les difficultés.',
          'Le scout est économe et prend soin du bien d’autrui.',
          'Le scout est pur dans ses pensées, ses paroles et ses actes.',
        ]),
        sourceLine('p. 2, « IV. Les articles de la loi scoute »'),
      ),
    },
    { title: 'Comprendre et appliquer la loi dans la vie quotidienne', content: EMPTY },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    note(
      'A_VERIFIER',
      0,
      'Accords de la source conservés (« Principes Social », « Principes Personnel ») : à relire.',
    ),
    note(
      'A_VERIFIER',
      2,
      'Articles conservés tels que dans la source (p. 2). Formulation à confronter au texte officiel de la loi en vigueur dans le mouvement.',
    ),
    emptyLessonNote(3, 'la source ne développe pas l’application de la loi.'),
    note(
      'INFORMATION',
      3,
      'Piste du document de découpage : associer trois situations vécues à trois articles de la loi ; échange oral et situations pratiques.',
    ),
  ],
};

const M03: SourceModule = {
  key: 'NT-SCOUT-M03',
  slug: 'nt-scout-m03-la-methode-scoute',
  title: 'La méthode scoute',
  summary: 'Les huit éléments de la méthode scoute.',
  objectives: ['Identifier les huit éléments et les reconnaître dans une activité.'],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 1',
  lessons: [
    {
      title: 'Présentation des huit éléments',
      content: doc(
        paragraph('La méthode scoute est un système d’éducation fondé sur 08 éléments :'),
        ordered([
          'La Loi et la promesse',
          'La vie en petit groupe',
          'La vie en nature',
          'Le soutien adulte',
          'Le cadre symbolique',
          'L’éducation par action',
          'La progression personnelle',
          'L’engagement communautaire.',
        ]),
        sourceLine('p. 1'),
      ),
    },
    { title: 'Loi et promesse', content: EMPTY },
    { title: 'Vie en petit groupe', content: EMPTY },
    { title: 'Vie dans la nature', content: EMPTY },
    { title: 'Soutien adulte et cadre symbolique', content: EMPTY },
    { title: 'Éducation par l’action', content: EMPTY },
    { title: 'Progression personnelle et engagement communautaire', content: EMPTY },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    emptyLessonNote(
      1,
      'la source nomme seulement l’élément (p. 1). Le texte de la loi figure dans le module NT-SCOUT-M02 ; la promesse est absente de la source.',
    ),
    emptyLessonNote(2, 'la source nomme seulement l’élément (p. 1).'),
    emptyLessonNote(3, 'la source nomme seulement l’élément (p. 1).'),
    emptyLessonNote(4, 'la source nomme seulement ces deux éléments (p. 1).'),
    emptyLessonNote(5, 'la source nomme seulement l’élément (p. 1).'),
    emptyLessonNote(6, 'la source nomme seulement ces deux éléments (p. 1).'),
    note(
      'INFORMATION',
      null,
      'Piste du document de découpage : construire une activité de service et identifier quatre éléments vécus.',
    ),
  ],
};

const M04: SourceModule = {
  key: 'NT-SCOUT-M04',
  slug: 'nt-scout-m04-initiation-au-morse',
  title: 'Initiation au Morse',
  summary: 'Le code Morse : principe, alphabet, chiffres, signaux et abréviations.',
  objectives: ['Distinguer point et trait et transmettre un court message.'],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 3 à 6',
  lessons: [
    {
      title: 'Définition et histoire du Morse',
      content: doc(
        paragraph(
          'Le Morse est un système de communication inventé par Samuel Morse utilisant des signaux courts (points) et longs (traits) pour représenter des lettres et des chiffres, utilisé par les radioamateurs, scouts et militaires pour transmettre des messages par signaux sonores ou lumineux.',
        ),
        heading('Le Code Morse (télégraphie)'),
        bullets([
          'Histoire : Inventé dans les années 1830 par Samuel Morse et Alfred Vail.',
          'Utilisation : Communications militaires, radioamateurs (OM), scouts, signalisation maritime.',
        ]),
        sourceLine('p. 3'),
      ),
    },
    {
      title: 'Points, traits et silences',
      content: doc(
        bullets([
          'Principe : Associe chaque lettre, chiffre et signe de ponctuation à une combinaison de points (courts) et de traits (longs), avec des silences entre les signaux.',
        ]),
        sourceLine('p. 3'),
      ),
    },
    {
      title: 'Alphabet et chiffres',
      content: doc(
        paragraph(
          'Transcription du tableau « L’Alphabet Morse » de la source. « · » désigne un point, « — » un trait.',
        ),
        heading('Lettres'),
        morseList(MORSE_LETTERS),
        heading('Chiffres'),
        morseList(MORSE_DIGITS),
        sourceLine('p. 4, illustration « L’Alphabet Morse »'),
      ),
    },
    {
      title: 'Signaux et abréviations',
      content: doc(
        paragraph('Exemples de signaux/abréviations :'),
        bullets(['... --- ... (SOS).', 'MCI (Merci).', 'BSR (Bonsoir).']),
        heading('Quelques abréviations et signaux courants'),
        bullets([
          'SOS : ···—··· (Signal de détresse).',
          'SK : ···- – -· (Fin de transmission, « Silent Key »).',
          'CQ : ·-·-· ·-·-· (Appel général, Calling All Stations).',
          'BSR : Bonsoir (Bonne soirée).',
          'BJR : Bonjour.',
          'GA : ·-· (Bon après-midi, Good Afternoon).',
          'GM : --· (Bonjour, le matin, Good Morning).',
          'GN : -. (Bonne nuit, Good Night).',
          'TU : ..- (Merci, Thank You).',
          'TKS/TNX : Merci.',
          'AR : ·-·-· (Fin du message, je vous passe le contact).',
          'BT : -··· (Pause, coupure, Break).',
          'CUL : ..-.- (À plus tard, See You Later).',
          'FB : ..-.· (Bon travail, Fine Business).',
          'OM : Old Man (Désigne un opérateur masculin).',
          'YL : Young Lady (Désigne une femme).',
          'QTH : Ma position/ville.',
          'HW? : Comment allez-vous ? / Comment me recevez-vous ? (How Copy?).',
          'BSR : Bonsoir (ou GE - Good Evening).',
          'BJR : Bonjour (ou GM - Good Morning).',
          'CUL : À plus tard (See You Later).',
          'CUAGN : Espère vous revoir bientôt (Hope See You Again).',
          'GA : Bon après-midi (Good Afternoon).',
          'GB : Au revoir (Good Bye).',
          'HI : Rire (telegraph laugh).',
          'K : Invitation à transmettre (À vous).',
          'MCI / TKS / TNX : Merci (Merci).',
          'OM : Vieux (Old Man), terme pour un opérateur masculin.',
          "PSE : S'il vous plaît (Please).",
          'RST : Rapport de signal (Readability, Signal strength, Tone).',
          'SK : Fin de communication (Silent Key).',
          'SOS : Code de détresse (Sauvez-nous).',
          '73 : Meilleurs vœux (Best Regards).',
          '88 : Baisers et câlins (Bises et câlins).',
        ]),
        sourceLine('p. 3 à 6'),
      ),
    },
    { title: 'Exercice de transmission en équipe', content: EMPTY },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    note(
      'A_VERIFIER',
      0,
      'Incohérence interne : la définition attribue l’invention à Samuel Morse seul, l’historique à Samuel Morse et Alfred Vail.',
    ),
    note(
      'A_COMPLETER',
      1,
      'Durées relatives du point, du trait et des silences non précisées dans la source.',
    ),
    note(
      'A_VERIFIER',
      2,
      'Transcription manuelle de l’illustration de la p. 4 (lettres A–Z, chiffres 0–9) : à relire contre l’original. Les signes de ponctuation cités dans le principe ne figurent pas dans le tableau.',
    ),
    note(
      'INFORMATION',
      2,
      'L’image d’origine n’est pas importée : sa provenance et ses droits de réutilisation ne sont pas établis, et la plateforme n’héberge pas de fichiers (images en URL https uniquement).',
    ),
    note(
      'A_VERIFIER',
      3,
      'Codes conservés tels que dans la source, sans correction. Plusieurs ne correspondent pas à la composition lettre par lettre selon l’alphabet de la p. 4 (ex. « GA : ·-· » = R, « GN : -. » = N, « SOS : ···—··· » avec un seul trait, « CQ », « BT », « SK »). Doublons : BSR, BJR, CUL, GA, OM, SK, SOS, Merci. Ne pas publier avant vérification (vigilance signalée par le document de découpage).',
    ),
    emptyLessonNote(4, 'aucun exercice dans la source.'),
    note(
      'INFORMATION',
      4,
      'Piste du document de découpage : transmission lumineuse ou sonore, pratique en binôme.',
    ),
  ],
};

/** Modules importés, dans l'ordre de création. */
export const SCOUTISME_BASE_MODULES: readonly SourceModule[] = [M01, M02, M03, M04];
