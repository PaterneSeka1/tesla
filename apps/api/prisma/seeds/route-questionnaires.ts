/**
 * Questionnaires d'entraînement du catalogue (demande du responsable, 2026-10-30 ; enrichis le
 * 2026-11-02) : un par module, rattaché au module et à son étape recommandée.
 *
 * - Questions à correction automatique déterministe uniquement : choix unique, choix multiple (tout ou
 *   rien), vrai/faux et réponse courte à variantes acceptées (D138) lorsque la réponse est sans
 *   ambiguïté (sigle, nombre, mot décodé). Les questions de réflexion restent dans les leçons
 *   (« Pour réfléchir ») : elles ne sont jamais notées par mot-clé.
 * - Chaque question renvoie à la leçon qui contient la réponse, avec une explication et un niveau de
 *   difficulté ; l'ensemble est versé dans le corrigé (`guidance`), jamais transmis au routier avant
 *   correction.
 * - Un résultat ne change jamais l'étape officielle ni ne valide un acquis.
 * Créés par la commande de mise en service (`mise-en-service.ts`), au nom du responsable.
 */
import { type CreateQuestionInput } from '@tesla/shared';

type Question = Omit<CreateQuestionInput, 'versionId'>;

export type QuizLevel = 'facile' | 'moyen' | 'difficile';

export interface QuizQuestion {
  /** Leçon (rang à partir de 1) qui contient la réponse. */
  lesson: number;
  level: QuizLevel;
  /** Explication pédagogique de la bonne réponse. */
  explanation: string;
  question: Question;
}

export interface QuizDefinition {
  /** Code source du module évalué (clé de réexécution). */
  moduleKey: string;
  questions: QuizQuestion[];
}

export const QUIZ_INSTRUCTIONS =
  'Questionnaire d’entraînement : relis le module avant de répondre. Une seule réponse sauf mention contraire. Le résultat t’aide à faire le point ; il ne change pas ton étape.';

/** Choix unique : une seule proposition marquée `true`. */
const one = (prompt: string, ...options: [string, boolean][]): Question => ({
  type: 'CHOIX_UNIQUE',
  prompt,
  points: 1,
  options: options.map(([label, isCorrect]) => ({ label, isCorrect })),
});
/** Choix multiple, tout ou rien. */
const many = (prompt: string, ...options: [string, boolean][]): Question => ({
  type: 'CHOIX_MULTIPLE',
  prompt: `${prompt} (plusieurs réponses)`,
  points: 2,
  options: options.map(([label, isCorrect]) => ({ label, isCorrect })),
});
const trueFalse = (prompt: string, value: boolean): Question => ({
  type: 'VRAI_FAUX',
  prompt,
  points: 1,
  options: [
    { label: 'Vrai', isCorrect: value },
    { label: 'Faux', isCorrect: !value },
  ],
});
/** Réponse courte sans ambiguïté : variantes acceptées (comparées sans tenir compte de la casse). */
const short = (prompt: string, expected: string, ...variants: string[]): Question => ({
  type: 'REPONSE_COURTE',
  prompt,
  points: 1,
  expectedAnswer: expected,
  acceptedAnswers: [expected, ...variants],
});
const ok = (label: string): [string, boolean] => [label, true];
const no = (label: string): [string, boolean] => [label, false];
const q = (
  lesson: number,
  level: QuizLevel,
  explanation: string,
  question: Question,
): QuizQuestion => ({ lesson, level, explanation, question });

/**
 * Question prête pour l'API : le corrigé (`guidance`) indique la leçon de référence, le niveau et
 * l'explication. `lessonTitles` : titres des leçons du module, dans l'ordre.
 */
export function quizQuestionInput(item: QuizQuestion, lessonTitles: readonly string[]): Question {
  const title = lessonTitles[item.lesson - 1];
  if (!title) throw new Error(`Leçon ${item.lesson} absente du module.`);
  return {
    ...item.question,
    guidance: `Leçon ${item.lesson} « ${title} » — difficulté ${item.level}. ${item.explanation}`,
  };
}

export const ROUTE_QUIZZES: readonly QuizDefinition[] = [
  // ─── Bases du scoutisme ────────────────────────────────────────────────
  {
    moduleKey: 'NT-SCOUT-M01',
    questions: [
      q(
        1,
        'facile',
        'Le scoutisme est fondé sur le volontariat : on y entre et on y reste par choix.',
        one(
          'Le scoutisme est un mouvement éducatif pour les jeunes fondé sur :',
          no('l’obligation scolaire'),
          ok('le volontariat'),
          no('l’appartenance politique'),
          no('la sélection sportive'),
        ),
      ),
      q(
        1,
        'facile',
        'Le scoutisme est apolitique et accueille chacun sans distinction d’origine ni de croyance.',
        trueFalse(
          'Le scoutisme est un mouvement apolitique, sans distinction d’origine et de croyance.',
          true,
        ),
      ),
      q(
        2,
        'moyen',
        'L’objectif du scoutisme couvre quatre dimensions : physique, intellectuelle, spirituelle et sociale. La dimension financière n’en fait pas partie.',
        many(
          'Le scoutisme aide les jeunes à réaliser pleinement leurs possibilités :',
          ok('physiques'),
          ok('intellectuelles'),
          ok('spirituelles'),
          ok('sociales'),
          no('financières'),
        ),
      ),
      q(
        3,
        'facile',
        'BP est né le 22 février 1857 et mort le 8 janvier 1941.',
        one(
          'En quelle année est né Robert Baden-Powell ?',
          ok('1857'),
          no('1907'),
          no('1918'),
          no('1941'),
        ),
      ),
      q(
        3,
        'moyen',
        'Olave St Clair Soames, devenue Olave Baden-Powell, a pris une part active au développement du guidisme.',
        one(
          'Qui était l’épouse de Robert Baden-Powell ?',
          no('Agnes Baden-Powell'),
          ok('Olave St Clair Soames'),
          no('Juliette Gordon Low'),
          no('Marie Curie'),
        ),
      ),
      q(
        5,
        'facile',
        'Le camp expérimental de Brownsea, en 1907, est le point de départ du mouvement.',
        one(
          'En quelle année a eu lieu le premier camp scout expérimental sur l’île de Brownsea ?',
          no('1857'),
          ok('1907'),
          no('1920'),
          no('1937'),
        ),
      ),
      q(
        5,
        'facile',
        'Les Routiers, branche des jeunes adultes, ont été créés en 1918.',
        short(
          'En quelle année les Routiers ont-ils été créés ? (réponds par l’année)',
          '1918',
          'en 1918',
        ),
      ),
      q(
        4,
        'facile',
        'L’emblème du scoutisme est la fleur de lys, qui indiquait le nord sur les boussoles.',
        one(
          'Quel est l’emblème du scoutisme ?',
          no('L’étoile or'),
          no('La boussole'),
          ok('La fleur de lys'),
          no('Le foulard'),
        ),
      ),
      q(
        4,
        'moyen',
        'Les trois pétales rappellent les trois devoirs de la promesse : envers Dieu, envers les autres, envers soi-même.',
        one(
          'Que rappellent les trois pétales de la fleur de lys ?',
          ok('Les trois devoirs : envers Dieu, envers les autres, envers soi-même'),
          no('Les trois étapes du scoutisme : louveteaux, scouts, routiers'),
          no('Les trois couleurs du drapeau ivoirien'),
          no('Les trois fondateurs du mouvement'),
        ),
      ),
      q(
        4,
        'moyen',
        'OMMS signifie Organisation Mondiale du Mouvement Scout ; son siège opérationnel est à Kuala Lumpur depuis 2014.',
        one(
          'Que signifie le sigle OMMS ?',
          ok('Organisation Mondiale du Mouvement Scout'),
          no('Organisation Mondiale des Mouvements Sportifs'),
          no('Office Militaire du Mouvement Scout'),
          no('Ordre Mondial des Messagers Scouts'),
        ),
      ),
      q(
        5,
        'moyen',
        'Le scoutisme est arrivé en Côte d’Ivoire en 1937, à la paroisse Sainte-Jeanne-d’Arc de Treichville.',
        one(
          'Où le scoutisme est-il arrivé en Côte d’Ivoire, en 1937 ?',
          no('À la cathédrale du Plateau'),
          ok('À la paroisse Sainte-Jeanne-d’Arc de Treichville'),
          no('À Grand-Bassam'),
          no('À Bouaké'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M02',
    questions: [
      q(
        1,
        'facile',
        'Les trois principes sont les devoirs envers Dieu, envers les autres et envers soi-même.',
        many(
          'Quels sont les trois principes scouts ?',
          ok('Principe spirituel (devoir envers Dieu)'),
          ok('Principe social (devoir envers les autres)'),
          ok('Principe personnel (devoir envers soi-même)'),
          no('Principe sportif'),
          no('Principe politique'),
        ),
      ),
      q(
        1,
        'facile',
        'Le principe social est le devoir envers les autres.',
        one(
          'Le principe social correspond au devoir envers :',
          no('Dieu'),
          no('soi-même'),
          ok('les autres'),
          no('la nature'),
        ),
      ),
      q(
        2,
        'facile',
        'Les trois vertus retenues par le document sont la franchise, le dévouement et la pureté.',
        many(
          'Quelles sont les trois vertus scoutes ?',
          ok('Franchise'),
          no('Richesse'),
          ok('Dévouement'),
          no('Force'),
          ok('Pureté'),
        ),
      ),
      q(
        2,
        'moyen',
        'La franchise consiste à dire vrai et à agir sans double jeu.',
        one(
          'Quelle vertu consiste à dire vrai et à agir sans double jeu ?',
          ok('La franchise'),
          no('Le dévouement'),
          no('La pureté'),
        ),
      ),
      q(
        3,
        'facile',
        'La loi scoute compte dix articles.',
        short(
          'Combien d’articles compte la loi scoute ? (réponds par un nombre)',
          '10',
          'dix',
          '10 articles',
          'dix articles',
        ),
      ),
      q(
        3,
        'facile',
        'Premier article : « Le scout met son honneur à mériter confiance. »',
        one(
          'Complète le premier article : « Le scout met son honneur à… »',
          no('être le premier'),
          ok('mériter confiance'),
          no('commander les autres'),
          no('gagner'),
        ),
      ),
      q(
        3,
        'facile',
        'Quatrième article : « Le scout est l’ami de tous et le frère de tout autre scout. »',
        trueFalse(
          'Selon la loi scoute, le scout est l’ami de tous et le frère de tout autre scout.',
          true,
        ),
      ),
      q(
        3,
        'moyen',
        'Neuvième article : « Le scout est économe et prend soin du bien d’autrui. »',
        one(
          'Quel article dit que le scout est économe et prend soin du bien d’autrui ?',
          no('L’article 1'),
          no('L’article 5'),
          ok('L’article 9'),
          no('L’article 10'),
        ),
      ),
      q(
        4,
        'moyen',
        'Chaque article dit « Le scout est » ou « Le scout fait » : la loi décrit un idéal choisi librement.',
        one(
          'Comment la leçon présente-t-elle la loi scoute ?',
          no('Comme un règlement assorti de sanctions'),
          ok('Comme un idéal positif, choisi librement'),
          no('Comme une liste d’interdits'),
          no('Comme une règle réservée aux chefs'),
        ),
      ),
      q(
        4,
        'difficile',
        'Garder son calme et encourager les autres dans la fatigue illustre l’article 8 : « maître de soi, il sourit et chante dans les difficultés ».',
        one(
          'Pendant le Raid, la pluie et la fatigue s’installent ; un routier garde son calme et encourage les autres. Quel article vit-il ?',
          no('Article 2 : loyal à son pays'),
          no('Article 6 : il aime les plantes et les animaux'),
          ok('Article 8 : maître de soi, il sourit et chante dans les difficultés'),
          no('Article 9 : économe'),
        ),
      ),
      q(
        4,
        'difficile',
        'Tenir la caisse et rendre chaque reçu, c’est mériter confiance (article 1) et prendre soin du bien d’autrui (article 9).',
        many(
          'Un routier tient la caisse du Mini-Camp et rend chaque reçu. Quels articles vit-il ?',
          ok('Article 1 : mériter confiance'),
          ok('Article 9 : économe, il prend soin du bien d’autrui'),
          no('Article 6 : il voit dans la nature l’œuvre de Dieu'),
          no('Article 5 : courtois et chevaleresque'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M03',
    questions: [
      q(
        1,
        'facile',
        'La méthode scoute repose sur huit éléments.',
        short(
          'Sur combien d’éléments repose la méthode scoute ? (réponds par un nombre)',
          '8',
          'huit',
          '8 éléments',
          'huit éléments',
        ),
      ),
      q(
        1,
        'facile',
        'La compétition et le classement ne font pas partie des huit éléments.',
        many(
          'Lesquels font partie des éléments de la méthode scoute ?',
          ok('La loi et la promesse'),
          ok('La vie en petit groupe'),
          no('La compétition entre équipes'),
          ok('La vie en nature'),
          no('Le classement des scouts'),
        ),
      ),
      q(
        1,
        'moyen',
        'Les éléments forment un tout : une activité réussie en fait vivre plusieurs à la fois.',
        trueFalse(
          'Chaque activité scoute ne doit faire vivre qu’un seul élément de la méthode.',
          false,
        ),
      ),
      q(
        2,
        'moyen',
        'À la Route, la promesse prend la forme de l’Engagement routier, acte volontaire et jamais automatique.',
        one(
          'À la Route, quelle forme prend la promesse ?',
          no('La remise du foulard'),
          ok('L’Engagement routier'),
          no('Le Raid'),
          no('La cérémonie de départ'),
        ),
      ),
      q(
        3,
        'facile',
        'À la Route, le petit groupe est l’équipe, au sein de la communauté.',
        one(
          'À la Route, comment se vit la vie en petit groupe ?',
          ok('En équipe, au sein de la communauté'),
          no('Seul, sans groupe'),
          no('Uniquement en grand rassemblement'),
          no('Par branche d’âge mélangée'),
        ),
      ),
      q(
        4,
        'moyen',
        'Le Raid, activité itinérante au contact de la nature, est l’expression la plus forte de la vie en nature à la Route.',
        one(
          'Quelle activité routière exprime le plus fortement la vie dans la nature ?',
          no('La réunion d’équipe'),
          ok('Le Raid'),
          no('La remise des flots'),
          no('Le questionnaire'),
        ),
      ),
      q(
        5,
        'facile',
        'Le soutien adulte désigne l’accompagnement par des adultes ; à la Route, c’est le rôle du coordinateur.',
        one(
          'Quel élément de la méthode désigne l’accompagnement par des adultes ?',
          no('Le cadre symbolique'),
          ok('Le soutien adulte'),
          no('L’engagement communautaire'),
          no('L’éducation par l’action'),
        ),
      ),
      q(
        5,
        'moyen',
        'Flots, étoiles et cérémonies relèvent du cadre symbolique ; la caisse de l’équipe n’est pas un symbole.',
        many(
          'Lesquels relèvent du cadre symbolique de la Route ?',
          ok('Les flots de fin d’étape'),
          ok('Les cérémonies'),
          ok('La Prière de la Route'),
          no('La caisse de l’équipe'),
        ),
      ),
      q(
        6,
        'moyen',
        'L’Entreprise est l’outil principal de formation par l’action à la Route.',
        one(
          'Quel est l’outil principal de l’éducation par l’action à la Route ?',
          no('Le cours magistral'),
          ok('L’Entreprise'),
          no('La cérémonie d’accueil'),
          no('Le questionnaire d’entraînement'),
        ),
      ),
      q(
        7,
        'moyen',
        'La progression est personnelle et l’étape officielle est toujours décidée par le responsable.',
        trueFalse(
          'Dans la progression personnelle, chacun avance à son rythme, sans comparaison.',
          true,
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M04',
    questions: [
      q(
        1,
        'facile',
        'Le code a été mis au point dans les années 1830 par Samuel Morse et Alfred Vail.',
        one(
          'Qui a mis au point le code Morse, dans les années 1830 ?',
          ok('Samuel Morse, avec Alfred Vail'),
          no('Robert Baden-Powell'),
          no('Nikola Tesla'),
          no('Olave Baden-Powell'),
        ),
      ),
      q(
        2,
        'moyen',
        'Un trait dure trois fois plus longtemps qu’un point.',
        one('Combien d’unités dure un trait ?', no('1'), no('2'), ok('3'), no('7')),
      ),
      q(
        2,
        'difficile',
        'Le silence entre deux mots dure 7 unités (3 entre deux lettres, 1 entre deux signaux).',
        one(
          'Combien d’unités dure le silence entre deux mots ?',
          no('1'),
          no('3'),
          no('5'),
          ok('7'),
        ),
      ),
      q(
        3,
        'facile',
        'S s’écrit trois points.',
        one('Comment s’écrit la lettre S ?', ok('· · ·'), no('— — —'), no('· —'), no('— · —')),
      ),
      q(
        3,
        'facile',
        'O s’écrit trois traits.',
        one('Comment s’écrit la lettre O ?', no('· · ·'), no('· — ·'), ok('— — —'), no('— ·')),
      ),
      q(
        3,
        'facile',
        'E, la lettre la plus fréquente, s’écrit un seul point.',
        one(
          'La lettre E correspond à :',
          ok('un seul point'),
          no('un seul trait'),
          no('deux points'),
          no('un point et un trait'),
        ),
      ),
      q(
        3,
        'moyen',
        '· — · = R, — — — = O, · · — = U, — = T, · = E : le mot est « ROUTE ».',
        short('Décode ce mot : · — ·   — — —   · · —   —   · (réponds en lettres)', 'ROUTE'),
      ),
      q(
        3,
        'moyen',
        'De 1 à 5, les points remplacent les traits un à un : 5 s’écrit cinq points.',
        one(
          'Comment s’écrit le chiffre 5 ?',
          ok('· · · · ·'),
          no('— — — — —'),
          no('· — — — —'),
          no('— · · · ·'),
        ),
      ),
      q(
        4,
        'facile',
        'SOS s’écrit trois points, trois traits, trois points, et ne s’emploie qu’en détresse réelle.',
        trueFalse('Le signal de détresse SOS s’écrit · · · — — — · · ·.', true),
      ),
      q(
        4,
        'moyen',
        '« K » invite le correspondant à transmettre (« à vous »).',
        one(
          'Que signifie l’abréviation « K » ?',
          no('Fin de communication'),
          ok('Invitation à transmettre (« à vous »)'),
          no('Merci'),
          no('Bonne nuit'),
        ),
      ),
      q(
        5,
        'moyen',
        'Le récepteur répète toujours le message pour le vérifier ; la précision compte plus que la vitesse.',
        one(
          'Dans l’exercice en binôme, que fait le récepteur après avoir reçu le mot ?',
          no('Il passe au mot suivant sans rien dire'),
          ok('Il renvoie le mot reçu pour le vérifier'),
          no('Il transmet SOS'),
          no('Il change de lampe'),
        ),
      ),
    ],
  },
  // ─── Noviciat ──────────────────────────────────────────────────────────
  {
    moduleKey: 'NT-ROUTE-M03',
    questions: [
      q(
        1,
        'facile',
        'La Route s’adresse à des jeunes adultes, généralement âgés de 18 à 21 ans.',
        one(
          'À quels jeunes s’adresse généralement la Branche Route ?',
          no('De 12 à 15 ans'),
          no('De 15 à 18 ans'),
          ok('De 18 à 21 ans'),
          no('De 21 à 25 ans'),
        ),
      ),
      q(
        1,
        'facile',
        'La Route n’est pas un espace de transition ou d’attente, mais un lieu d’accomplissement.',
        trueFalse('La Route est un espace de transition ou d’attente entre deux branches.', false),
      ),
      q(
        1,
        'moyen',
        'Pour BP, la Route n’est pas vagabonder sans but mais rechercher sa voie avec un objectif défini.',
        one(
          'Pour Baden-Powell, faire la Route, c’est :',
          no('vagabonder sans but'),
          ok('rechercher sa voie avec un objectif défini, en connaissant les difficultés'),
          no('suivre un chef sans poser de questions'),
          no('réaliser un exploit sportif'),
        ),
      ),
      q(
        2,
        'moyen',
        'La progression vise une croissance individuelle et collective ; la richesse n’en fait pas partie.',
        many(
          'La progression permet une croissance :',
          ok('individuelle (responsabilité, engagement, vocation)'),
          ok('collective (équipe, communauté, projets)'),
          no('financière'),
        ),
      ),
      q(
        2,
        'moyen',
        'La réussite de la Route se mesure à la qualité des adultes qui en émergent, pas seulement au nombre de présents.',
        one(
          'Selon le manuel, à quoi se mesure la réussite de la Branche Route ?',
          no('Au nombre de jeunes présents'),
          ok('À la qualité des adultes qui en émergent'),
          no('Au nombre de cérémonies organisées'),
          no('Aux résultats des questionnaires'),
        ),
      ),
      q(
        3,
        'facile',
        'Le coordinateur accompagne sans se substituer, encourage sans diriger et rappelle le cap.',
        one(
          'Le coordinateur de communauté est :',
          no('un chef qui commande'),
          no('un animateur qui occupe'),
          ok('un accompagnateur adulte, garant du cadre et du sens'),
          no('un arbitre qui classe les routiers'),
        ),
      ),
      q(
        3,
        'moyen',
        'Le routier quitte progressivement la posture de celui qui est guidé pour celle de celui qui choisit, agit et s’engage librement.',
        trueFalse(
          'À la Route, le jeune passe progressivement de celui qui est guidé à celui qui choisit, agit et s’engage librement.',
          true,
        ),
      ),
      q(
        4,
        'facile',
        'Au terme du parcours, le routier sert parce qu’il l’a choisi, non parce qu’on le lui propose.',
        one(
          'Au terme du parcours, le routier sert :',
          no('parce qu’on le lui propose'),
          no('pour obtenir une étoile'),
          ok('parce qu’il l’a choisi'),
          no('uniquement pendant les camps'),
        ),
      ),
      q(
        5,
        'moyen',
        'Réunions d’équipe et de communauté et temps de partage fraternels donnent au novice un sentiment d’appartenance.',
        one(
          'Dès le noviciat, qu’est-ce qui donne au jeune un sentiment d’appartenance ?',
          ok('Les réunions de communauté et d’équipe et les temps de partage fraternels'),
          no('La réussite d’un questionnaire'),
          no('Le port immédiat du flot routier'),
          no('Un entretien d’embauche'),
        ),
      ),
      q(
        6,
        'facile',
        'La Prière de la Route est un texte fondamental, consultable dans la rubrique « Textes fondamentaux ».',
        one(
          'Où trouve-t-on la Prière de la Route dans la bibliothèque ?',
          no('Dans le module sur le Raid'),
          ok('Dans la rubrique « Textes fondamentaux »'),
          no('Dans les questionnaires'),
          no('Elle n’est pas disponible'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M04',
    questions: [
      q(
        1,
        'facile',
        'Les quatre étapes se succèdent : Noviciat, Apprentissage, Compagnonnage, Départ routier.',
        one(
          'Dans quel ordre se succèdent les étapes du parcours routier ?',
          no('Apprentissage, Noviciat, Compagnonnage, Départ routier'),
          ok('Noviciat, Apprentissage, Compagnonnage, Départ routier'),
          no('Noviciat, Compagnonnage, Apprentissage, Départ routier'),
          no('Compagnonnage, Apprentissage, Noviciat, Départ routier'),
        ),
      ),
      q(
        1,
        'facile',
        'Le texte du manuel donne un mois au Noviciat.',
        one(
          'Quelle est la durée générale du Noviciat ?',
          ok('Un mois'),
          no('Six mois'),
          no('Dix mois'),
          no('Une année scoute'),
        ),
      ),
      q(
        1,
        'moyen',
        'Six mois pour l’Apprentissage, selon le texte du manuel.',
        one(
          'Quelle est la durée générale de l’Apprentissage ?',
          no('Un mois'),
          ok('Six mois'),
          no('Dix mois'),
          no('Une année scoute'),
        ),
      ),
      q(
        1,
        'moyen',
        'Dix mois pour le Compagnonnage : deux pour le Raid et huit pour l’Entreprise.',
        one(
          'Quelle est la durée générale du Compagnonnage ?',
          no('Un mois'),
          no('Six mois'),
          ok('Dix mois'),
          no('Une année scoute'),
        ),
      ),
      q(
        1,
        'difficile',
        'La durée d’une étape couvre plusieurs activités ; seule une décision du responsable change l’étape.',
        trueFalse('Les durées du tableau synoptique font changer d’étape automatiquement.', false),
      ),
      q(
        3,
        'moyen',
        'L’Engagement routier et le Mini-Camp sont les deux activités majeures de l’Apprentissage.',
        many(
          'Quelles sont les activités majeures de l’Apprentissage ?',
          ok('L’Engagement routier'),
          ok('Le Mini-Camp'),
          no('Le Raid'),
          no('L’Envoi'),
        ),
      ),
      q(
        4,
        'moyen',
        'Le compagnonnage fait passer du faire au transmettre.',
        one(
          'Le compagnonnage fait passer le routier :',
          ok('du faire au transmettre'),
          no('du transmettre au faire'),
          no('de l’équipe à la solitude'),
          no('de l’action à l’observation'),
        ),
      ),
      q(
        6,
        'facile',
        'Le flot gris marque la fin du Noviciat.',
        one(
          'Quel signe marque la fin du Noviciat ?',
          ok('Le flot gris'),
          no('Le flot marron'),
          no('Le flot routier'),
          no('L’étoile or'),
        ),
      ),
      q(
        6,
        'moyen',
        'Un signe distinctif n’est pas une récompense : il rend visible un chemin déjà engagé.',
        trueFalse('Un signe distinctif est une récompense donnée au meilleur routier.', false),
      ),
      q(
        7,
        'facile',
        'La cérémonie d’accueil a lieu de 1 à 15 jours après l’arrivée.',
        one(
          'Quand a lieu la cérémonie d’accueil ?',
          no('À la fin de la quatrième étape'),
          ok('De 1 à 15 jours après l’arrivée'),
          no('À chaque fin d’étape'),
          no('Au 21e anniversaire'),
        ),
      ),
      q(
        8,
        'facile',
        'Aucun calcul ni aucun questionnaire ne change l’étape officielle : seule une décision du responsable le fait.',
        trueFalse('Réussir un questionnaire change automatiquement l’étape officielle.', false),
      ),
    ],
  },
  // ─── Apprentissage ─────────────────────────────────────────────────────
  {
    moduleKey: 'NT-ROUTE-M05',
    questions: [
      q(
        1,
        'facile',
        'La vie en petit groupe est l’un des huit éléments de la méthode scoute.',
        trueFalse('La vie en petit groupe est l’un des huit éléments de la méthode scoute.', true),
      ),
      q(
        1,
        'moyen',
        'La communauté réunit les équipes, la maîtrise routier et l’aumônier.',
        many(
          'Qui compose la communauté, d’après le tableau des cérémonies ?',
          ok('Les équipes'),
          ok('La maîtrise routier'),
          ok('L’aumônier'),
          no('Les parents des routiers'),
        ),
      ),
      q(
        2,
        'facile',
        'Dès l’accueil, le jeune comprend qu’il n’est plus seulement participant, mais acteur de sa communauté.',
        one(
          'Dès l’accueil, le jeune comprend qu’il est :',
          no('un simple spectateur'),
          ok('un acteur de sa communauté'),
          no('un invité de passage'),
          no('le chef de la communauté'),
        ),
      ),
      q(
        3,
        'facile',
        'L’apprentissage fait passer de la participation à l’implication.',
        one(
          'Pendant l’apprentissage, le routier passe :',
          ok('de la participation à l’implication'),
          no('de l’implication à la participation'),
          no('du service au repos'),
          no('de l’équipe à l’action solitaire'),
        ),
      ),
      q(
        3,
        'moyen',
        'Agir, persévérer, assumer des engagements et mesurer les conséquences de ses choix.',
        many(
          'Selon le manuel, pendant l’apprentissage, le routier apprend à :',
          ok('agir et persévérer'),
          ok('assumer des engagements'),
          ok('mesurer les conséquences de ses choix'),
          no('éviter toute responsabilité'),
        ),
      ),
      q(
        3,
        'facile',
        'Article 1 : « Le scout met son honneur à mériter confiance. »',
        one(
          'Le premier article de la loi scoute dit :',
          ok('« Le scout met son honneur à mériter confiance. »'),
          no('« Le scout obéit sans réplique. »'),
          no('« Le scout est économe. »'),
          no('« Le scout est courtois et chevaleresque. »'),
        ),
      ),
      q(
        4,
        'moyen',
        'Le travail avec les autres se retrouve au Mini-Camp (responsabilité partagée) et dans l’Entreprise (travail en équipe).',
        many(
          'Dans quelles activités retrouve-t-on la collaboration ?',
          ok('Le Mini-Camp'),
          ok('L’Entreprise'),
          no('Un questionnaire en ligne'),
        ),
      ),
      q(
        5,
        'moyen',
        'Le routier commence à se former au leadership partagé pendant l’apprentissage.',
        one(
          'À quelle étape le routier commence-t-il à se former au leadership partagé ?',
          no('Noviciat'),
          ok('Apprentissage'),
          no('Départ routier'),
          no('Après la sortie de la branche'),
        ),
      ),
      q(
        6,
        'moyen',
        'Les temps de réflexion, de débat et de relecture donnent du sens à l’action menée.',
        one(
          'Pourquoi prévoir des temps de réflexion, de débat et de relecture ?',
          no('Pour remplir le programme'),
          ok('Pour donner du sens à l’action menée'),
          no('Pour classer les routiers'),
          no('Pour remplacer l’action'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M06',
    questions: [
      q(
        1,
        'facile',
        'L’engagement est un acte volontaire, personnel et réfléchi, jamais un passage automatique.',
        trueFalse('L’Engagement routier est un passage automatique.', false),
      ),
      q(
        1,
        'moyen',
        'Par l’engagement, le routier choisit de vivre selon la Charte de la branche.',
        one(
          'Par l’engagement, le routier choisit librement d’adhérer à l’idéal de la Route et de vivre selon :',
          ok('la Charte de la branche'),
          no('le règlement de son école'),
          no('les consignes de son équipe uniquement'),
          no('le programme annuel'),
        ),
      ),
      q(
        2,
        'facile',
        'L’insigne routier est l’attribut de l’Engagement.',
        one(
          'Quel attribut est associé à l’Engagement ?',
          no('Le flot gris'),
          ok('L’insigne routier'),
          no('L’étoile blanche'),
          no('La Bible'),
        ),
      ),
      q(
        2,
        'moyen',
        'L’engagement se prépare par des échanges personnels avec le coordinateur ou l’aumônier.',
        one(
          'Avec qui le jeune échange-t-il pour préparer son engagement ?',
          no('Avec ses parents uniquement'),
          ok('Avec le coordinateur ou l’aumônier'),
          no('Avec le responsable du district seulement'),
          no('Avec personne : c’est automatique'),
        ),
      ),
      q(
        4,
        'moyen',
        'La cérémonie d’accueil doit être simple, sobre et signifiante, centrée sur l’accueil et la confiance.',
        one(
          'Comment doit être la cérémonie d’accueil ?',
          ok('Simple, sobre et signifiante'),
          no('Longue et spectaculaire'),
          no('Secrète'),
          no('Réservée aux chefs'),
        ),
      ),
      q(
        4,
        'moyen',
        'Le foulard est l’attribut associé à l’accueil.',
        one(
          'Quel attribut est associé à l’accueil ?',
          ok('Le foulard'),
          no('Le flot gris'),
          no('L’étoile marron'),
          no('L’insigne routier'),
        ),
      ),
      q(
        5,
        'moyen',
        'La cérémonie d’engagement se vit dans le recueillement et la solennité ; elle n’est jamais banalisée.',
        many(
          'Comment doit être vécue la cérémonie d’engagement ?',
          ok('Préparée avec soin'),
          ok('Dans un climat de recueillement et de solennité'),
          no('Rapidement, pour ne pas perdre de temps'),
          no('Sans témoin'),
        ),
      ),
      q(
        6,
        'facile',
        'La remise des flots a lieu à chaque fin d’étape.',
        one(
          'Quand a lieu la remise des flots ?',
          no('De 1 à 15 jours après l’arrivée'),
          no('Une seule fois, au départ'),
          ok('À chaque fin d’étape'),
          no('Chaque mois'),
        ),
      ),
      q(
        6,
        'moyen',
        'Les objets de la remise des flots sont les flots et l’étendard ; boussole et bougie appartiennent à la cérémonie de départ.',
        many(
          'Quels objets figurent lors de la cérémonie de remise des flots ?',
          ok('Les flots'),
          ok('L’étendard'),
          no('La boussole'),
          no('La bougie'),
        ),
      ),
      q(
        6,
        'facile',
        'La remise des flots s’accompagne toujours d’une explication claire de leur signification.',
        trueFalse(
          'La remise des flots doit toujours être accompagnée d’une explication claire de leur signification.',
          true,
        ),
      ),
      q(
        7,
        'moyen',
        'Le flot marron marque la fin de l’apprentissage.',
        one(
          'Quel flot marque la fin de l’apprentissage ?',
          no('Le flot gris'),
          ok('Le flot marron'),
          no('Le flot routier'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M07',
    questions: [
      q(
        1,
        'facile',
        'Le Mini-Camp est un temps de vie communautaire prolongée, généralement sur quelques jours.',
        one(
          'Le Mini-Camp est :',
          no('une activité itinérante vécue seul'),
          ok('un temps de vie communautaire prolongée, généralement sur quelques jours'),
          no('un projet répondant à un besoin de la société'),
          no('une cérémonie de fin d’étape'),
        ),
      ),
      q(
        1,
        'facile',
        'L’étoile marron est l’attribut du Mini-Camp.',
        one(
          'Quel attribut est associé au Mini-Camp ?',
          ok('L’étoile marron'),
          no('L’étoile blanche'),
          no('L’étoile or'),
          no('Le flot gris'),
        ),
      ),
      q(
        2,
        'moyen',
        'Le Mini-Camp développe la vie collective, la responsabilité partagée, la gestion commune, la fraternité et la simplicité.',
        many(
          'Que développe le Mini-Camp ?',
          ok('Le sens de la vie collective'),
          ok('La responsabilité partagée'),
          ok('La capacité à vivre simplement'),
          no('L’esprit de compétition'),
          no('La performance sportive individuelle'),
        ),
      ),
      q(
        3,
        'facile',
        'Le Mini-Camp est préparé et organisé par les routiers eux-mêmes.',
        one(
          'Qui prépare et organise le Mini-Camp ?',
          no('Le coordinateur seul'),
          no('L’aumônier'),
          ok('Les routiers eux-mêmes'),
          no('Les parents'),
        ),
      ),
      q(
        4,
        'moyen',
        'Intendance, animation, rôles et budget sont répartis entre routiers ; les flots ne s’organisent pas.',
        many(
          'Que répartissent les routiers pour organiser le Mini-Camp ?',
          ok('L’intendance'),
          ok('L’animation'),
          ok('Les rôles'),
          ok('Le budget'),
          no('Les flots'),
        ),
      ),
      q(
        4,
        'facile',
        'Le coordinateur veille à l’équilibre entre action, formation et temps spirituels.',
        trueFalse(
          'Le coordinateur veille à l’équilibre entre action, formation et temps spirituels.',
          true,
        ),
      ),
      q(
        5,
        'moyen',
        'Les règles de sécurité sont celles de la communauté et du mouvement, présentées par l’encadrement avant le départ.',
        one(
          'Qui présente les règles de sécurité du Mini-Camp ?',
          ok('L’encadrement, avant le départ'),
          no('Chaque routier invente les siennes'),
          no('Personne : il n’y en a pas'),
          no('Le questionnaire'),
        ),
      ),
      q(
        6,
        'moyen',
        'Le Mini-Camp est un temps privilégié d’échanges profonds, de formation et de temps spirituels.',
        trueFalse(
          'Le Mini-Camp est uniquement un temps de loisir, sans dimension spirituelle.',
          false,
        ),
      ),
      q(
        7,
        'moyen',
        'Le Mini-Camp se conclut par une relecture collective et personnelle.',
        one(
          'Comment se conclut le Mini-Camp ?',
          no('Par un classement des équipes'),
          ok('Par une relecture collective et personnelle'),
          no('Par la remise du flot routier'),
          no('Par un examen écrit'),
        ),
      ),
    ],
  },
  // ─── Compagnonnage ─────────────────────────────────────────────────────
  {
    moduleKey: 'NT-ROUTE-M08',
    questions: [
      q(
        1,
        'facile',
        'Le Raid est itinérant, vécu seul ou en petite équipe.',
        one(
          'Le Raid est :',
          ok('une activité itinérante, vécue individuellement ou en petite équipe'),
          no('un temps de vie communautaire sur place'),
          no('un projet collectif au service de la société'),
          no('une compétition entre équipes'),
        ),
      ),
      q(
        1,
        'facile',
        'L’étoile blanche est l’attribut du Raid.',
        one(
          'Quel attribut est associé au Raid ?',
          no('L’étoile marron'),
          ok('L’étoile blanche'),
          no('L’étoile or'),
          no('L’insigne routier'),
        ),
      ),
      q(
        1,
        'moyen',
        'Le compagnonnage consacre deux mois à la préparation du Raid.',
        one(
          'Combien de temps le compagnonnage consacre-t-il à la préparation du Raid (durée générale) ?',
          no('Un mois'),
          ok('Deux mois'),
          no('Six mois'),
          no('Huit mois'),
        ),
      ),
      q(
        1,
        'moyen',
        'Effort, sobriété et autonomie caractérisent le Raid.',
        many(
          'Dans quelle situation le Raid met-il le routier ?',
          ok('L’effort'),
          ok('La sobriété'),
          ok('L’autonomie'),
          no('Le confort'),
        ),
      ),
      q(
        2,
        'moyen',
        'Le Raid développe l’endurance, la gestion de l’effort, l’autonomie, la solidarité et la relecture.',
        many(
          'Que permet le Raid ?',
          ok('Développer l’endurance physique et mentale'),
          ok('Vivre la solidarité et l’entraide'),
          ok('Prendre du recul par la relecture'),
          no('Battre un record de vitesse'),
        ),
      ),
      q(
        3,
        'moyen',
        'Itinéraire réaliste, sécurité claire, objectifs éducatifs et relecture prévue : quatre éléments de la préparation.',
        many(
          'Que doit comporter la préparation du Raid ?',
          ok('Un itinéraire réaliste'),
          ok('Des règles de sécurité claires'),
          ok('Des objectifs éducatifs définis'),
          ok('Des temps de relecture prévus à l’issue'),
          no('Un classement des participants'),
        ),
      ),
      q(
        6,
        'facile',
        'Le Raid reste une expérience de croissance, jamais un défi sportif ou une mise en danger.',
        trueFalse(
          'Le Raid est un défi sportif où l’on peut se mettre en danger pour se dépasser.',
          false,
        ),
      ),
      q(
        6,
        'difficile',
        'Face à un risque, on applique les règles présentées et validées par l’encadrement : l’objectif est la croissance, pas l’exploit.',
        one(
          'Pendant la préparation, ton équipe veut ajouter une étape très longue et risquée « pour se dépasser ». Que faire ?',
          no('L’ajouter : un Raid doit être un exploit'),
          ok('Garder un itinéraire réaliste et s’en tenir aux règles validées par l’encadrement'),
          no('Partir sans prévenir le coordinateur'),
          no('Supprimer la relecture pour gagner du temps'),
        ),
      ),
      q(
        7,
        'moyen',
        'Les temps de relecture, prévus à l’issue du Raid, permettent de prendre du recul sur le plan personnel et spirituel.',
        one(
          'Quand a lieu la relecture du Raid ?',
          no('Elle est facultative'),
          ok('À l’issue du Raid, comme prévu dans la préparation'),
          no('Un an plus tard'),
          no('Pendant la cérémonie d’accueil'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M09',
    questions: [
      q(
        1,
        'facile',
        'L’Entreprise est un projet collectif structuré qui répond à un besoin réel de la société.',
        one(
          'L’Entreprise est :',
          no('une activité de loisir de l’équipe'),
          ok('un projet collectif structuré qui répond à un besoin réel de la société'),
          no('un stage professionnel individuel'),
          no('une cérémonie de fin d’étape'),
        ),
      ),
      q(
        1,
        'moyen',
        'L’Entreprise est reconnue par un label de domaine d’action.',
        one(
          'Quelle reconnaissance est associée à l’Entreprise ?',
          no('L’étoile or'),
          no('La Bible'),
          ok('Un label de domaine d’action'),
          no('L’insigne routier'),
        ),
      ),
      q(
        1,
        'moyen',
        'L’Entreprise n’est pas d’abord une activité de financement : elle répond collectivement à un besoin concret.',
        trueFalse('L’Entreprise sert d’abord à financer les activités de la communauté.', false),
      ),
      q(
        2,
        'facile',
        'Toute Entreprise commence par l’analyse du besoin.',
        one(
          'Quelle est la première étape d’une Entreprise ?',
          ok('L’analyse du besoin'),
          no('La réalisation'),
          no('Le bilan'),
          no('La planification'),
        ),
      ),
      q(
        3,
        'moyen',
        'Ordre : analyse du besoin, objectifs, planification, réalisation, évaluation, bilan.',
        one(
          'Quelle étape vient juste après la réalisation ?',
          no('La planification'),
          no('La définition des objectifs'),
          ok('L’évaluation'),
          no('L’analyse du besoin'),
        ),
      ),
      q(
        3,
        'difficile',
        'La planification suit la définition des objectifs et précède la réalisation.',
        one(
          'Quelle étape vient juste après la définition des objectifs ?',
          no('L’analyse du besoin'),
          ok('La planification'),
          no('Le bilan'),
          no('L’évaluation'),
        ),
      ),
      q(
        5,
        'moyen',
        'Le compagnonnage inclut l’implication dans des partenariats extérieurs.',
        trueFalse('Une Entreprise peut mobiliser des partenaires extérieurs.', true),
      ),
      q(
        6,
        'facile',
        'Le coordinateur accompagne sans diriger et questionne la pertinence du projet.',
        trueFalse('Le coordinateur dirige l’Entreprise à la place des routiers.', false),
      ),
      q(
        7,
        'moyen',
        'L’évaluation compare ce qui a été réalisé aux objectifs définis.',
        one(
          'Que compare l’évaluation d’une Entreprise ?',
          ok('Ce qui a été réalisé et les objectifs définis'),
          no('Les routiers entre eux'),
          no('Deux équipes concurrentes'),
          no('Le budget de deux années'),
        ),
      ),
      q(
        8,
        'moyen',
        'Le bilan clôt l’Entreprise et ouvre la transmission aux plus jeunes.',
        one(
          'Le compagnonnage fait passer le routier :',
          ok('du faire au transmettre'),
          no('du transmettre au faire'),
          no('de l’équipe à la solitude'),
          no('de l’action à l’observation'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M10',
    questions: [
      q(
        1,
        'facile',
        'Le manuel présente dix domaines d’action.',
        short(
          'Combien de domaines d’action le manuel présente-t-il ? (réponds par un nombre)',
          '10',
          'dix',
          '10 domaines',
          'dix domaines',
        ),
      ),
      q(
        1,
        'moyen',
        'Santé et sport : mode de vie sain, équilibre physique et mental, prévention des comportements à risque.',
        one(
          'Une Entreprise de prévention des comportements à risque relève du domaine :',
          ok('Santé et sport'),
          no('Art et culture'),
          no('Agro-pastorale'),
          no('TIC'),
        ),
      ),
      q(
        2,
        'facile',
        'Solidarité, inclusion sociale et lutte contre la pauvreté relèvent du développement social.',
        one(
          'Les actions de solidarité, d’inclusion sociale et de lutte contre la pauvreté relèvent du domaine :',
          ok('Développement social'),
          no('Éducation à la paix'),
          no('TIC'),
          no('Agro-pastorale'),
        ),
      ),
      q(
        3,
        'moyen',
        'L’éducation à la paix concerne la paix, le dialogue, la citoyenneté et la résolution non violente des conflits.',
        one(
          'La résolution non violente des conflits relève du domaine :',
          no('Environnement'),
          ok('Éducation à la paix'),
          no('Santé et sport'),
          no('Vie et foi'),
        ),
      ),
      q(
        4,
        'facile',
        'Selon le manuel, Plastic Tide Turners est associé à l’environnement (pollution plastique).',
        one(
          'Selon le manuel, le programme Plastic Tide Turners est associé au domaine :',
          ok('Environnement'),
          no('Santé et sport'),
          no('Art et culture'),
          no('TIC'),
        ),
      ),
      q(
        6,
        'moyen',
        'Agriculture, élevage, sécurité alimentaire et développement rural : domaine agro-pastoral.',
        one(
          'Un jardin potager communautaire relève du domaine :',
          no('Art et culture'),
          ok('Agro-pastorale'),
          no('Éducation sexuelle'),
          no('TIC'),
        ),
      ),
      q(
        7,
        'facile',
        'Le domaine « Vie et foi » se vit dans le respect des convictions de chacun.',
        trueFalse(
          'Le domaine « Vie et foi » se vit dans le respect des convictions de chacun.',
          true,
        ),
      ),
      q(
        8,
        'moyen',
        'Selon le manuel, Patrimonito concerne la protection et la valorisation du patrimoine culturel.',
        one(
          'Selon le manuel, le programme Patrimonito est associé au domaine :',
          no('Environnement'),
          no('Éducation à la paix'),
          ok('Art et culture'),
          no('Santé et sport'),
        ),
      ),
      q(
        9,
        'moyen',
        'Selon le manuel, Safe from Harm est la politique mondiale de protection de l’enfance.',
        one(
          'Selon le manuel, le programme Safe from Harm est associé au domaine :',
          no('Développement social'),
          ok('Éducation et protection de l’enfance'),
          no('Vie et foi'),
          no('Agro-pastorale'),
        ),
      ),
      q(
        10,
        'difficile',
        'Le domaine se choisit à partir d’un besoin réel, pas l’inverse.',
        one(
          'Comment choisir le domaine d’action d’une Entreprise ?',
          no('Choisir d’abord le domaine le plus prestigieux'),
          ok('Partir d’un besoin réel, puis identifier le domaine correspondant'),
          no('Tirer le domaine au sort'),
          no('Reprendre le domaine de l’année précédente'),
        ),
      ),
    ],
  },
  // ─── Départ routier ────────────────────────────────────────────────────
  {
    moduleKey: 'NT-ROUTE-M11',
    questions: [
      q(
        1,
        'facile',
        'Au Départ routier, le service devient un choix personnel et durable.',
        one(
          'À l’étape du Départ routier, le service est :',
          no('une suite d’actions ponctuelles imposées'),
          ok('un choix personnel et durable d’engagement au service des autres'),
          no('un projet collectif de l’équipe uniquement'),
          no('une obligation de quelques jours'),
        ),
      ),
      q(
        1,
        'facile',
        'L’étoile or est l’attribut du Service.',
        one(
          'Quel attribut est associé au Service ?',
          no('L’étoile blanche'),
          no('L’étoile marron'),
          ok('L’étoile or'),
          no('Le flot routier'),
        ),
      ),
      q(
        2,
        'moyen',
        'Le routier sert parce qu’il l’a choisi ; son engagement est libre et durable.',
        trueFalse('Au Départ routier, le routier sert parce qu’on le lui impose.', false),
      ),
      q(
        3,
        'moyen',
        'Le service peut être associatif, social, ecclésial ou citoyen ; jamais commercial.',
        many(
          'Le service personnel peut être :',
          ok('associatif'),
          ok('social'),
          ok('ecclésial'),
          ok('citoyen'),
          no('commercial'),
        ),
      ),
      q(
        3,
        'facile',
        'Le Départ routier peut se vivre soit en branche, soit dans une ONG.',
        trueFalse('Le Départ routier peut se vivre soit en branche, soit dans une ONG.', true),
      ),
      q(
        4,
        'moyen',
        'À cette étape, l’itinéraire devient plus individualisé tout en restant relié à la vie communautaire.',
        one(
          'À l’étape du Départ routier, l’itinéraire du routier devient :',
          ok('plus individualisé, tout en restant relié à la communauté'),
          no('entièrement coupé de la communauté'),
          no('identique pour tous les routiers'),
          no('décidé par les parents'),
        ),
      ),
      q(
        5,
        'facile',
        'Accompagnement, relecture et témoignage soutiennent le cheminement.',
        one(
          'Qu’est-ce qui soutient le cheminement du service ?',
          ok('Des temps d’accompagnement, de relecture et de témoignage'),
          no('Un classement des services rendus'),
          no('Un contrôle hebdomadaire des présences'),
          no('Rien : le routier est seul'),
        ),
      ),
      q(
        6,
        'moyen',
        'La relecture vérifie la cohérence entre ce que l’on dit et ce que l’on fait.',
        one(
          'À quoi sert la relecture de l’engagement ?',
          no('À noter le routier'),
          ok('À vérifier la cohérence entre ce que l’on dit et ce que l’on fait'),
          no('À changer automatiquement d’étape'),
          no('À choisir un nouveau domaine d’action'),
        ),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M12',
    questions: [
      q(
        1,
        'facile',
        'Le départ n’est pas une fin mais un envoi dans la société.',
        trueFalse(
          'Le départ routier est une fin : le routier quitte simplement la communauté.',
          false,
        ),
      ),
      q(
        1,
        'moyen',
        'Le Départ routier est une démarche d’engagement ; la sortie au 21e anniversaire est une règle d’âge distincte.',
        trueFalse(
          'Le Départ routier et la sortie de la branche au 21e anniversaire sont la même chose.',
          false,
        ),
      ),
      q(
        2,
        'moyen',
        'Le départ donne une cohérence à tout le parcours : il reconnaît le chemin accompli et l’oriente vers l’avenir.',
        one(
          'Que permet le départ au jeune ?',
          ok('Donner une cohérence à tout son parcours'),
          no('Effacer les étapes précédentes'),
          no('Obtenir un diplôme scolaire'),
          no('Quitter la communauté sans bilan'),
        ),
      ),
      q(
        3,
        'moyen',
        'Avant le départ : service personnel dans la durée, relecture approfondie, échanges avec le coordinateur et la communauté.',
        many(
          'Quelles activités précèdent le départ routier ?',
          ok('Un service personnel vécu dans la durée'),
          ok('Des temps de relecture approfondie'),
          ok('Des échanges avec le coordinateur et la communauté'),
          no('Un tournoi sportif'),
        ),
      ),
      q(
        5,
        'facile',
        'La cérémonie de départ a lieu à la fin de la quatrième étape.',
        one(
          'Quand a lieu la cérémonie de départ ?',
          no('À chaque fin d’étape'),
          no('De 1 à 15 jours après l’arrivée'),
          ok('À la fin de la quatrième étape'),
          no('Au début du compagnonnage'),
        ),
      ),
      q(
        5,
        'moyen',
        'Bible, boussole, bougie et étendard ; les flots appartiennent à la remise des flots.',
        many(
          'Quels objets et symboles figurent lors de la cérémonie de départ ?',
          ok('La Bible'),
          ok('La boussole'),
          ok('La bougie'),
          ok('L’étendard'),
          no('Les flots'),
        ),
      ),
      q(
        5,
        'moyen',
        'Les acteurs : routiers en fin de service, équipes, maîtrise routier, parrain, aumônier.',
        many(
          'Qui participe à la cérémonie de départ ?',
          ok('Le ou les routiers en fin de service'),
          ok('Le parrain'),
          ok('L’aumônier'),
          no('Les novices seulement'),
        ),
      ),
      q(
        5,
        'facile',
        'La Bible est l’attribut associé à l’Envoi.',
        one(
          'Quel attribut est associé à l’Envoi ?',
          ok('La Bible'),
          no('L’étoile or'),
          no('Le foulard'),
          no('Le flot gris'),
        ),
      ),
      q(
        6,
        'moyen',
        'Le routier retire du départ la conscience d’être envoyé, et non simplement de quitter la communauté.',
        one(
          'Que retire le routier de son départ ?',
          ok('La conscience d’être envoyé dans la société'),
          no('Le sentiment d’avoir terminé tout engagement'),
          no('Une note finale'),
          no('Le droit de ne plus servir'),
        ),
      ),
    ],
  },
];
