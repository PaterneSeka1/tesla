/**
 * Modules pédagogiques issus du document « BASE DU SCOUTISME » (6 pages), découpés selon la proposition
 * `Nikola_Tesla_Modules_Scoutisme.md`.
 *
 * Révision 2 (finalisation du catalogue, 2026-11-02) :
 * - les leçons vides sont rédigées : développements pédagogiques reliés au manuel SAPF-Route, signalés
 *   comme ajouts éditoriaux dans les notes ;
 * - les coquilles sont corrigées et les faits historiques vérifiés auprès de références publiques ; le
 *   texte original de chaque passage corrigé reste consigné dans les notes (rien n'est corrigé
 *   silencieusement) ;
 * - le texte de la loi scoute reste celui du document ;
 * - les codes Morse des abréviations sont recomposés lettre par lettre depuis l'alphabet de la p. 4
 *   (`morseOf`), au lieu des codes erronés de la source.
 * Les points qui exigent encore une décision humaine restent des notes « À vérifier ».
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
const quote = (text: string): LessonBlock => ({ type: 'blockquote', content: [paragraph(text)] });
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
/** Référence complémentaire (manuel SAPF-Route ou référence publique vérifiée). */
const referenceLine = (text: string): LessonBlock => ({
  type: 'paragraph',
  content: [{ type: 'text', text: `Référence : ${text}.`, marks: [{ type: 'italic' }] }],
});
/** Activité de réflexion et points essentiels (ajouts éditoriaux). */
const reflect = (...questions: string[]): LessonBlock[] => [
  heading('Pour réfléchir'),
  bullets(questions),
];
const remember = (...points: string[]): LessonBlock[] => [heading('À retenir'), bullets(points)];
const doc = (...content: (LessonBlock | LessonBlock[])[]): LessonDocument => ({
  type: 'doc',
  content: content.flat(),
});

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
    `Étape recommandée « ${stage} » : proposition pédagogique, pas une condition de progression.`,
  ),
  note(
    'INFORMATION',
    null,
    'Questionnaire d’entraînement préparé (prisma/seeds/route-questionnaires.ts) : créé, approuvé et publié avec le module par la mise en service, au nom du responsable.',
  ),
  note(
    'INFORMATION',
    null,
    'Révision 2 (2026-11-02) : rubriques « À retenir » et « Pour réfléchir », exemples et liens avec la Route sont des ajouts éditoriaux.',
  ),
];

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

const MORSE = new Map([...MORSE_LETTERS, ...MORSE_DIGITS]);

/**
 * Code d'un mot composé lettre par lettre depuis l'alphabet de la p. 4 : signes d'une lettre accolés,
 * lettres séparées par une espace (ex. « SOS » → « ··· ——— ··· »).
 */
export function morseOf(word: string): string {
  return [...word.toUpperCase()]
    .map((sign) => {
      const code = MORSE.get(sign);
      if (!code) throw new Error(`Signe « ${sign} » absent de l’alphabet Morse de la source.`);
      return code.replaceAll(' ', '');
    })
    .join(' ');
}

const morseList = (entries: readonly (readonly [string, string])[]) =>
  bullets(entries.map(([sign, code]) => `${sign} : ${code}`));

/** Abréviations retenues (sens repris de la source, doublons fusionnés), codes recomposés. */
export const MORSE_ABBREVIATIONS: readonly (readonly [string, string])[] = [
  ['SOS', 'signal de détresse ; transmis d’un seul tenant, sans pause entre les lettres'],
  ['CQ', 'appel général (« à toutes les stations »)'],
  ['K', 'invitation à transmettre (« à vous »)'],
  ['AR', 'fin du message'],
  ['SK', 'fin de la communication'],
  ['BT', 'pause, séparation'],
  ['MCI', 'merci (on trouve aussi TKS, TNX ou TU)'],
  ['PSE', 's’il vous plaît'],
  ['BJR', 'bonjour (on trouve aussi GM, « good morning »)'],
  ['GA', 'bon après-midi'],
  ['BSR', 'bonsoir (on trouve aussi GE, « good evening »)'],
  ['GN', 'bonne nuit'],
  ['GB', 'au revoir'],
  ['CUL', 'à plus tard'],
  ['CUAGN', 'au plaisir de vous retrouver'],
  ['FB', 'bon travail'],
  ['HW', 'comment me recevez-vous ?'],
  ['RST', 'rapport de signal : lisibilité, force, tonalité'],
  ['QTH', 'ma position, ma ville'],
  ['OM', 'opérateur (« old man »)'],
  ['YL', 'opératrice (« young lady »)'],
  ['HI', 'rire'],
  ['73', 'meilleures salutations'],
];

// ─── Modules ───────────────────────────────────────────────────────────────

const M01: SourceModule = {
  key: 'NT-SCOUT-M01',
  slug: 'nt-scout-m01-decouvrir-le-scoutisme',
  title: 'Découvrir le scoutisme',
  summary:
    'Ce qu’est le scoutisme, ce qu’il cherche à développer chez le jeune, son fondateur, son emblème, son organisation mondiale et ses grandes dates.',
  objectives: [
    'Définir le scoutisme et son objectif éducatif.',
    'Présenter Baden-Powell et les origines du mouvement.',
    'Expliquer l’emblème scout et le rôle de l’OMMS.',
    'Situer les grandes dates du scoutisme, jusqu’à son arrivée en Côte d’Ivoire.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 1 à 3',
  lessons: [
    {
      title: 'Définition du scoutisme',
      content: doc(
        paragraph(
          'Le scoutisme est un mouvement éducatif pour les jeunes fondé sur le volontariat : personne n’y est inscrit de force, chacun choisit d’y entrer et d’y rester.',
        ),
        paragraph('C’est un mouvement apolitique, sans distinction d’origine et de croyance.'),
        paragraph(
          'Pour son bon fonctionnement, le scoutisme utilise une manière de faire appelée la méthode scoute (voir le module « La méthode scoute »).',
        ),
        heading('Pourquoi c’est important à la Route'),
        paragraph(
          'Le routier est un jeune adulte : c’est librement qu’il poursuit le chemin scout. Le volontariat n’est donc pas un détail, il est la condition de l’engagement qu’il prendra plus tard.',
        ),
        remember(
          'Le scoutisme éduque ; ce n’est ni un club de loisirs ni un parti.',
          'On y entre et on y reste par choix.',
          'Il accueille chacun sans distinction d’origine ni de croyance.',
        ),
        sourceLine('p. 1'),
      ),
    },
    {
      title: 'Objectifs du scoutisme',
      content: doc(
        paragraph(
          'Le scoutisme veut contribuer au développement des jeunes en les aidant à réaliser pleinement leurs possibilités physiques, intellectuelles, spirituelles et sociales.',
        ),
        heading('Quatre dimensions de la personne'),
        bullets([
          'Physique : prendre soin de son corps, de sa santé, de son endurance.',
          'Intellectuelle : observer, comprendre, apprendre à réfléchir par soi-même.',
          'Spirituelle : chercher le sens de sa vie et vivre sa foi.',
          'Sociale : vivre avec les autres, servir, prendre sa place dans la société.',
        ]),
        heading('Application pratique'),
        paragraph(
          'Un Raid fait travailler l’endurance (physique), la lecture de carte (intellectuelle), la relecture du soir (spirituelle) et l’entraide en équipe (sociale) : une même activité fait grandir toute la personne.',
        ),
        ...reflect('Dans quelle dimension as-tu le plus grandi depuis ton arrivée ?'),
        sourceLine('p. 2'),
      ),
    },
    {
      title: 'Robert Baden-Powell et les origines',
      content: doc(
        heading('Le fondateur du scoutisme'),
        paragraph(
          'Robert Stephenson Smyth Baden-Powell, appelé « BP », est né le 22 février 1857 à Londres et mort le 8 janvier 1941. Son épouse, Olave St Clair Soames, devenue Olave Baden-Powell, a pris une part active au développement du guidisme.',
        ),
        heading('Les origines du mouvement'),
        paragraph(
          'En 1907, BP organise sur l’île de Brownsea, au Royaume-Uni, un premier camp expérimental avec une vingtaine de garçons. L’année suivante, il publie « Scouting for Boys » (« Éclaireurs »), qui donne naissance au mouvement.',
        ),
        paragraph(
          'Le mouvement s’ouvre ensuite aux filles et à tous les âges : guides (1910), louveteaux (1916), routiers (1918). Avec les routiers, BP propose aux jeunes adultes de « rechercher leur voie » (voir le module « Découverte de la branche Route »).',
        ),
        remember(
          'BP (1857–1941) est le fondateur du scoutisme.',
          'Le camp de Brownsea (1907) est le point de départ du mouvement.',
          'La Route est née en 1918 pour les jeunes adultes.',
        ),
        sourceLine('p. 1 et 3'),
        referenceLine(
          'notices biographiques publiques de Robert Baden-Powell (abbaye de Westminster, National Portrait Gallery)',
        ),
      ),
    },
    {
      title: 'La fleur de lys et l’OMMS',
      content: doc(
        heading('L’emblème du scoutisme'),
        paragraph('L’emblème du scoutisme est la fleur de lys.'),
        paragraph(
          'Sur les anciennes cartes et boussoles, la fleur de lys indiquait le nord : elle rappelle au scout de garder la bonne direction. Ses trois pétales rappellent les trois devoirs de la promesse, que l’on retrouve dans les trois principes : envers Dieu, envers les autres, envers soi-même (module « Loi, principes et vertus »).',
        ),
        heading('L’OMMS'),
        paragraph(
          'L’Organisation Mondiale du Mouvement Scout (OMMS) rassemble les organisations scoutes nationales reconnues. Son siège opérationnel, le Bureau mondial du scoutisme, est installé à Kuala Lumpur (Malaisie) depuis 2014 ; son siège légal reste à Genève (Suisse).',
        ),
        paragraph(
          'L’OMMS propose des programmes mondiaux auxquels une Entreprise routière peut se rattacher (module « Domaines d’action de l’Entreprise »).',
        ),
        remember(
          'Fleur de lys : garder le cap ; trois pétales, trois devoirs.',
          'OMMS : Organisation Mondiale du Mouvement Scout.',
        ),
        sourceLine('p. 1'),
        referenceLine('présentation publique de l’OMMS (scout.org)'),
      ),
    },
    {
      title: 'Les grandes dates du scoutisme',
      content: doc(
        bullets([
          '1907 : premier camp scout expérimental sur l’île de Brownsea (Royaume-Uni) par Robert Baden-Powell.',
          '1910 : naissance du mouvement des Guides (filles).',
          '1916 : naissance du louvetisme.',
          '1918 : création des Routiers (jeunes adultes).',
          '1920 : premier Jamboree mondial à Londres, marquant la reconnaissance internationale.',
          '1937 : arrivée du scoutisme en Côte d’Ivoire, à la paroisse Sainte-Jeanne-d’Arc de Treichville, par le révérend père Paul Rey.',
        ]),
        heading('Pour mémoriser'),
        paragraph(
          'Le mouvement naît en 1907 et s’ouvre en dix ans à toutes les tranches d’âge ; la Route existe depuis 1918. Le scoutisme est arrivé en Côte d’Ivoire à Treichville, la commune de notre district.',
        ),
        ...reflect(
          'Que représente pour toi le fait que le scoutisme ivoirien soit né à Treichville ?',
        ),
        sourceLine('p. 3'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    note(
      'INFORMATION',
      null,
      'Coquilles corrigées (texte original) : « appelé la méthode scout » → « appelée la méthode scoute » ; « intellectuel, spirituel et Social » → « intellectuelles, spirituelles et sociales » ; « Arrivé du scoutisme … paroisse sainte jeanne d’arc » → « arrivée … paroisse Sainte-Jeanne-d’Arc ».',
    ),
    note(
      'INFORMATION',
      2,
      'Identité corrigée et vérifiée (notices publiques : abbaye de Westminster, National Portrait Gallery) : la source écrit « Stephenson Smith Robert Baden Powell » et « Olave Sain Clair ». Compléments vérifiés : naissance à Londres, camp de Brownsea, « Scouting for Boys » (1908).',
    ),
    note(
      'INFORMATION',
      3,
      'OMMS : la source indique « (Malaysi) ». Vérifié (présentation publique de l’OMMS) : siège opérationnel à Kuala Lumpur depuis 2014, siège légal à Genève. Sens de la fleur de lys : présentation usuelle de l’emblème mondial (nord de la boussole, trois devoirs de la promesse).',
    ),
    note(
      'A_VERIFIER',
      4,
      'Entrée 1937 : date et paroisse confirmées par Vatican News (85 ans du scoutisme catholique, juillet 2022), qui écrit cependant « père Paul Ray » et non « Paul Rey » comme la source. Orthographe du nom à confirmer par le responsable (archives de la paroisse ou de l’association).',
    ),
  ],
};

const M02: SourceModule = {
  key: 'NT-SCOUT-M02',
  slug: 'nt-scout-m02-loi-principes-et-vertus',
  title: 'Loi, principes et vertus',
  summary:
    'Les trois principes, les trois vertus et les dix articles de la loi scoute, et la manière de les vivre au quotidien à la Route.',
  objectives: [
    'Nommer les trois principes et les trois vertus scoutes.',
    'Connaître les dix articles de la loi scoute.',
    'Relier un article de la loi à une situation concrète de la vie de communauté.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 2',
  lessons: [
    {
      title: 'Les trois principes scouts',
      content: doc(
        paragraph('Le scoutisme repose sur trois principes :'),
        ordered([
          'Principe spirituel : devoir envers Dieu.',
          'Principe social : devoir envers les autres.',
          'Principe personnel : devoir envers soi-même.',
        ]),
        paragraph(
          'Ces trois devoirs se tiennent : on ne sert pas durablement les autres sans prendre soin de soi, ni sans savoir pour qui et pour quoi l’on agit.',
        ),
        sourceLine('p. 2'),
      ),
    },
    {
      title: 'Les trois vertus',
      content: doc(
        paragraph('Le document retient trois vertus :'),
        ordered([
          'Franchise : dire vrai et agir sans double jeu.',
          'Dévouement : donner de son temps et de ses forces aux autres.',
          'Pureté : garder des pensées, des paroles et des actes droits.',
        ]),
        paragraph(
          'On retrouve ces vertus dans la loi : la confiance (article 1), le service (article 3) et la pureté (article 10).',
        ),
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
    {
      title: 'Comprendre et appliquer la loi dans la vie quotidienne',
      content: doc(
        heading('Objectifs'),
        bullets([
          'Comprendre que la loi est un idéal positif, pas une liste d’interdits.',
          'Relier un article de la loi à une situation vécue en équipe ou en communauté.',
        ]),
        heading('Une loi qui dit « le scout est »'),
        paragraph(
          'Chaque article commence par « Le scout est » ou « Le scout fait » : la loi décrit la personne que l’on choisit de devenir. Elle ne menace pas, elle propose un chemin. Au noviciat, le jeune la découvre ; à l’engagement, il choisit librement d’en faire sa règle de vie.',
        ),
        heading('Trois situations, trois articles'),
        bullets([
          'L’équipe confie la caisse du Mini-Camp à un routier : il tient les comptes et rend chaque reçu. Articles 1 (mériter confiance) et 9 (économe, soin du bien d’autrui).',
          'Un nouveau arrive à la communauté et ne connaît personne : un routier l’accueille et lui présente l’équipe. Article 4 (ami de tous, frère de tout autre scout).',
          'Pendant le Raid, la pluie et la fatigue s’installent : un routier garde son calme et encourage les autres. Article 8 (maître de soi, sourire dans les difficultés).',
        ]),
        heading('À la Route'),
        paragraph(
          'Le routier ne vit pas la loi comme un enfant qui obéit à une règle imposée : il la relit à la lumière de ses choix d’adulte. « Ne rien faire à moitié » (article 7) devient, par exemple, tenir jusqu’au bout une responsabilité acceptée dans l’Entreprise.',
        ),
        ...reflect(
          'Choisis trois articles et associe à chacun une situation que tu as vécue ce mois-ci.',
          'Quel article te demande aujourd’hui le plus d’effort ? Pourquoi ?',
        ),
        ...remember(
          'La loi décrit un idéal choisi librement.',
          'Elle se vit dans les petites choses : la caisse, l’accueil, la fatigue.',
          'Elle se relit en équipe et avec ceux qui accompagnent.',
        ),
        sourceLine('p. 2'),
        referenceLine('manuel « SAPF-Route », p. 3 (noviciat) et p. 9 (engagement routier)'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    note(
      'INFORMATION',
      0,
      'Accords corrigés (texte original : « Principes Social », « Principes Personnel ») ; phrase de liaison et définitions courtes des vertus : ajouts éditoriaux.',
    ),
    note(
      'INFORMATION',
      2,
      'Articles reproduits sans modification d’après le document (consigne du responsable : respecter le texte de la loi employé dans le document).',
    ),
    note(
      'INFORMATION',
      3,
      'Leçon rédigée en révision 2 d’après la piste du document de découpage (trois situations vécues, trois articles) ; situations fictives, présentées comme exemples.',
    ),
  ],
};

const M03: SourceModule = {
  key: 'NT-SCOUT-M03',
  slug: 'nt-scout-m03-la-methode-scoute',
  title: 'La méthode scoute',
  summary:
    'Les huit éléments de la méthode scoute et la manière dont chacun se vit concrètement à la Route.',
  objectives: [
    'Nommer les huit éléments de la méthode scoute.',
    'Expliquer chaque élément avec un exemple tiré de la vie routière.',
    'Reconnaître plusieurs éléments vécus dans une même activité.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 1',
  lessons: [
    {
      title: 'Présentation des huit éléments',
      content: doc(
        paragraph('La méthode scoute est un système d’éducation fondé sur huit éléments :'),
        ordered([
          'La loi et la promesse.',
          'La vie en petit groupe.',
          'La vie en nature.',
          'Le soutien adulte.',
          'Le cadre symbolique.',
          'L’éducation par l’action.',
          'La progression personnelle.',
          'L’engagement communautaire.',
        ]),
        paragraph(
          'Ces éléments forment un tout : c’est leur combinaison qui fait l’originalité du scoutisme. Une activité réussie en fait vivre plusieurs à la fois. Les leçons suivantes les présentent un à un, avec leur traduction à la Route.',
        ),
        sourceLine('p. 1'),
      ),
    },
    {
      title: 'Loi et promesse',
      content: doc(
        paragraph(
          'La loi décrit l’idéal du scout (module « Loi, principes et vertus ») ; la promesse est l’engagement personnel, pris librement devant les autres, de faire de son mieux pour vivre selon cette loi.',
        ),
        heading('À la Route'),
        paragraph(
          'La promesse prend la forme de l’Engagement routier : un acte volontaire, personnel et réfléchi par lequel le routier choisit d’adhérer à l’idéal de la Route et de vivre selon la Charte de la branche. Ce n’est jamais un passage automatique.',
        ),
        ...remember(
          'La loi propose un idéal ; la promesse est le choix personnel de le vivre.',
          'À la Route, ce choix devient l’Engagement routier.',
        ),
        sourceLine('p. 1 et 2'),
        referenceLine('manuel « SAPF-Route », p. 9'),
      ),
    },
    {
      title: 'Vie en petit groupe',
      content: doc(
        paragraph(
          'Le scoutisme fait vivre les jeunes en petits groupes stables. Chacun y est connu, chacun y a une place et une responsabilité ; le groupe apprend à décider et à agir ensemble.',
        ),
        heading('À la Route'),
        paragraph(
          'Le petit groupe, c’est l’équipe, au sein de la communauté. Dès le noviciat, le routier participe aux réunions d’équipe et de communauté ; pendant l’apprentissage, il apprend le travail en équipe et le leadership partagé ; au Mini-Camp, l’équipe organise elle-même l’intendance, l’animation, les rôles et le budget.',
        ),
        ...reflect('Quelle responsabilité exerces-tu aujourd’hui dans ton équipe ?'),
        sourceLine('p. 1'),
        referenceLine('manuel « SAPF-Route », p. 3, 5 et 6'),
      ),
    },
    {
      title: 'Vie dans la nature',
      content: doc(
        paragraph(
          'La nature est un lieu d’éducation : on y apprend la simplicité, l’effort, le respect de l’environnement et l’émerveillement. La loi le dit : « Le scout voit dans la nature l’œuvre de Dieu, il aime les plantes et les animaux » (article 6).',
        ),
        heading('À la Route'),
        paragraph(
          'Le Raid en est l’expression la plus forte : une activité itinérante, marquée par la marche, la simplicité des moyens et le contact direct avec la nature et les populations rencontrées. Le domaine d’action « Environnement » permet aussi de servir la nature par une Entreprise.',
        ),
        ...remember(
          'La nature éduque à la simplicité et au respect.',
          'À la Route : le Raid, le Mini-Camp, les Entreprises environnementales.',
        ),
        sourceLine('p. 1 et 2'),
        referenceLine('manuel « SAPF-Route », p. 5 et 7'),
      ),
    },
    {
      title: 'Soutien adulte et cadre symbolique',
      content: doc(
        heading('Le soutien adulte'),
        paragraph(
          'Des adultes accompagnent les jeunes : ils proposent, encouragent et garantissent le cadre, sans faire à leur place.',
        ),
        paragraph(
          'À la Route, ce rôle revient au coordinateur de communauté : ni un chef qui commande, ni un animateur qui occupe, mais un accompagnateur adulte, garant du cadre et du sens. L’aumônier accompagne la dimension spirituelle.',
        ),
        heading('Le cadre symbolique'),
        paragraph(
          'Des symboles, des signes et des cérémonies donnent un sens et une mémoire au chemin parcouru.',
        ),
        paragraph(
          'À la Route : la fleur de lys, la Prière de la Route, les flots de fin d’étape, les étoiles, l’insigne routier et les cérémonies (accueil, engagement, remise des flots, départ).',
        ),
        ...reflect('Quel symbole de la Route a le plus de sens pour toi ? Pourquoi ?'),
        sourceLine('p. 1'),
        referenceLine('manuel « SAPF-Route », p. 2, 4, 5 et 8 à 10'),
      ),
    },
    {
      title: 'Éducation par l’action',
      content: doc(
        paragraph(
          'Dans le scoutisme, on apprend en faisant : l’expérience concrète, préparée puis relue, éduque davantage qu’un cours. On parle aussi d’« apprendre par l’action ».',
        ),
        heading('À la Route'),
        paragraph(
          'L’Entreprise est l’outil principal de formation par l’action : un projet collectif structuré, conçu et réalisé par les routiers pour répondre à un besoin réel de la société, de l’analyse du besoin au bilan.',
        ),
        heading('Application pratique'),
        paragraph(
          'Préparer, agir, relire : après chaque activité, l’équipe se demande ce qui a fonctionné, ce qui n’a pas fonctionné, et ce qu’elle fera autrement.',
        ),
        sourceLine('p. 1'),
        referenceLine('manuel « SAPF-Route », p. 3 et 6'),
      ),
    },
    {
      title: 'Progression personnelle et engagement communautaire',
      content: doc(
        heading('La progression personnelle'),
        paragraph(
          'Chaque jeune avance à son rythme, avec des repères clairs. La progression donne une direction, un rythme et une profondeur au chemin, sans comparaison entre les personnes.',
        ),
        paragraph(
          'À la Route : quatre étapes (Noviciat, Apprentissage, Compagnonnage, Départ routier), chacune avec ses activités, ses signes et sa cérémonie. L’étape officielle est toujours décidée par le responsable.',
        ),
        heading('L’engagement communautaire'),
        paragraph(
          'Le scout ne grandit pas pour lui seul : il prend sa part dans la vie de sa communauté locale et de la société.',
        ),
        paragraph(
          'À la Route, le service traverse tout le parcours : de petites actions au noviciat, l’Entreprise au compagnonnage, un engagement personnel et durable au Départ routier.',
        ),
        ...reflect(
          'Choisis une activité récente de ta communauté : quels éléments de la méthode y as-tu reconnus ?',
        ),
        ...remember(
          'Huit éléments, un seul système : ils se combinent dans chaque activité.',
          'La progression est personnelle ; le service est tourné vers les autres.',
        ),
        sourceLine('p. 1'),
        referenceLine('manuel « SAPF-Route », p. 2 à 4'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    note(
      'INFORMATION',
      null,
      'Étape recommandée déplacée de « Apprentissage » à « Noviciat » (parcours demandé par le responsable, 2026-11-02 : la méthode scoute se découvre au noviciat).',
    ),
    note(
      'INFORMATION',
      null,
      'Leçons 2 à 7 rédigées en révision 2 : la source nomme seulement les éléments (p. 1) ; les explications sont des ajouts éditoriaux reliés au manuel SAPF-Route (pages citées en fin de leçon). La promesse n’est pas citée textuellement (texte validé absent).',
    ),
  ],
};

const M04: SourceModule = {
  key: 'NT-SCOUT-M04',
  slug: 'nt-scout-m04-initiation-au-morse',
  title: 'Initiation au Morse',
  summary:
    'Le code Morse : principe, rythme des signaux, alphabet et chiffres, abréviations usuelles et exercice de transmission en équipe.',
  objectives: [
    'Distinguer point, trait et silences et respecter leur durée.',
    'Coder et décoder un mot court avec l’alphabet Morse.',
    'Transmettre un court message en binôme, par signal sonore ou lumineux.',
  ],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  category: 'COMPLEMENTAIRE',
  sourceDocument: SOURCE_DOCUMENT,
  sourceSha256: SOURCE_SHA256,
  sourcePages: 'p. 3 à 6',
  lessons: [
    {
      title: 'Définition et histoire du Morse',
      content: doc(
        paragraph(
          'Le Morse est un système de communication qui utilise des signaux courts (points) et longs (traits) pour représenter des lettres et des chiffres. Il sert aux radioamateurs, aux scouts et aux militaires pour transmettre des messages par signaux sonores ou lumineux.',
        ),
        heading('Le code Morse (télégraphie)'),
        bullets([
          'Histoire : mis au point dans les années 1830 par Samuel Morse et Alfred Vail, pour le télégraphe électrique.',
          'Utilisation : communications militaires, radioamateurs, scouts, signalisation maritime.',
        ]),
        paragraph(
          'Pour un scout, le Morse est une technique de communication sans téléphone ni réseau : une lampe, un sifflet ou un miroir suffisent.',
        ),
        sourceLine('p. 3'),
      ),
    },
    {
      title: 'Points, traits et silences',
      content: doc(
        paragraph(
          'Le code associe chaque lettre, chiffre et signe de ponctuation à une combinaison de points (courts) et de traits (longs), avec des silences entre les signaux.',
        ),
        heading('Le rythme'),
        paragraph('Tout se mesure en « unités » de temps :'),
        bullets([
          'un point dure 1 unité ;',
          'un trait dure 3 unités ;',
          'le silence entre deux signaux d’une même lettre dure 1 unité ;',
          'le silence entre deux lettres dure 3 unités ;',
          'le silence entre deux mots dure 7 unités.',
        ]),
        paragraph(
          'Respecter ces silences est aussi important que bien former les signaux : sans eux, « ET » (· —) se confond avec « A » (·—).',
        ),
        sourceLine('p. 3'),
        referenceLine('Recommandation UIT-R M.1677-1, Union internationale des télécommunications'),
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
        heading('Astuce'),
        paragraph(
          'Les chiffres suivent une logique : de 1 à 5, les points remplacent un à un les traits ; de 6 à 0, les traits remplacent un à un les points.',
        ),
        sourceLine('p. 4, illustration « L’Alphabet Morse »'),
      ),
    },
    {
      title: 'Signaux et abréviations',
      content: doc(
        paragraph(
          'Pour gagner du temps, les opérateurs utilisent des abréviations. Chaque code ci-dessous est composé lettre par lettre avec l’alphabet de la leçon précédente (lettres séparées par une espace).',
        ),
        bullets(
          MORSE_ABBREVIATIONS.map(
            ([abbreviation, meaning]) => `${abbreviation} : ${meaning} — ${morseOf(abbreviation)}`,
          ),
        ),
        quote(
          'Le signal SOS (··· ——— ···) ne s’utilise qu’en cas de détresse réelle : ne jamais l’employer pour jouer.',
        ),
        sourceLine('p. 3 à 6'),
      ),
    },
    {
      title: 'Exercice de transmission en équipe',
      content: doc(
        heading('Objectif'),
        paragraph(
          'Transmettre et recevoir un message court, sans erreur, par signaux lumineux ou sonores, en binôme puis en équipe.',
        ),
        heading('Matériel'),
        bullets([
          'Une lampe de poche ou un sifflet par binôme.',
          'Une fiche avec l’alphabet Morse.',
          'Papier et crayon pour noter les messages reçus.',
        ]),
        heading('Déroulement'),
        ordered([
          'Échauffement : chacun transmet son prénom à son binôme, lentement, en respectant les silences.',
          'Message court : l’émetteur choisit un mot de cinq lettres au plus, le transmet ; le récepteur note chaque lettre puis annonce le mot.',
          'Contrôle : l’émetteur transmet « K » pour inviter à répondre ; le récepteur renvoie le mot reçu, puis « AR » pour clore le message.',
          'En équipe : un message de trois mots circule d’un binôme à l’autre ; le dernier binôme compare le message reçu au message de départ.',
          'Relecture : où sont nées les erreurs ? rythme, silences, lettres confondues ?',
        ]),
        heading('Sécurité'),
        paragraph(
          'Ne jamais diriger une lampe dans les yeux, ni transmettre « SOS » en exercice : ce signal est réservé à la détresse réelle.',
        ),
        ...remember(
          'La précision compte plus que la vitesse.',
          'Le récepteur répète toujours le message pour le vérifier.',
        ),
        sourceLine('p. 3 à 6'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    note(
      'INFORMATION',
      null,
      'Catégorie « Complémentaire » : technique scoute utile au Raid et aux jeux de piste, sans lien direct avec une étape de progression.',
    ),
    note(
      'INFORMATION',
      0,
      'Incohérence de la source résolue : la définition attribue l’invention à Samuel Morse seul, l’historique à Samuel Morse et Alfred Vail ; la leçon retient les deux.',
    ),
    note(
      'INFORMATION',
      1,
      'Durées du point, du trait et des silences complétées d’après la recommandation UIT-R M.1677-1 (absentes de la source).',
    ),
    note(
      'INFORMATION',
      2,
      'Transcription de l’illustration de la p. 4 contrôlée automatiquement (tests : 26 lettres et 10 chiffres conformes au code international) ; l’image d’origine n’est pas importée (droits non établis).',
    ),
    note(
      'INFORMATION',
      3,
      'Codes des abréviations recomposés depuis l’alphabet (les codes de la source étaient erronés : « GA : ·-· » = R, « GN : -. » = N, « SOS : ···—··· », « CQ », « BT », « SK ») ; doublons fusionnés (BSR, BJR, CUL, GA, OM, SK, SOS, merci) ; « HW? » transcrit « HW » ; « 88 » non retenu.',
    ),
    note(
      'INFORMATION',
      4,
      'Exercice rédigé en révision 2 d’après la piste du document de découpage (transmission lumineuse ou sonore, binôme).',
    ),
  ],
};

/** Modules importés, dans l'ordre de création. */
export const SCOUTISME_BASE_MODULES: readonly SourceModule[] = [M01, M02, M03, M04];
