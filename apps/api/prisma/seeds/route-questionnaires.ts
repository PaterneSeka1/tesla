/**
 * Questionnaires d'entraînement du catalogue (demande du responsable, 2026-10-30) : un par module,
 * rattaché au module et à son étape recommandée. Questions objectives uniquement (correction
 * automatique déterministe), toutes tirées du contenu des modules (manuel SAPF-Route, « Base du
 * scoutisme »). Un résultat ne change jamais l'étape officielle ni ne valide un acquis.
 * Créés par la commande de mise en service (`mise-en-service.ts`), au nom du responsable.
 */
import { type CreateQuestionInput } from '@tesla/shared';

type Question = Omit<CreateQuestionInput, 'versionId'>;

export interface QuizDefinition {
  /** Code source du module évalué (clé de réexécution). */
  moduleKey: string;
  questions: Question[];
}

export const QUIZ_INSTRUCTIONS =
  'Questionnaire d’entraînement : relis le module avant de répondre. Une seule réponse sauf mention contraire. Le résultat t’aide à faire le point ; il ne change pas ton étape.';

/** Choix unique : la première proposition marquée `true` est la bonne réponse. */
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
const ok = (label: string): [string, boolean] => [label, true];
const no = (label: string): [string, boolean] => [label, false];

export const ROUTE_QUIZZES: readonly QuizDefinition[] = [
  {
    moduleKey: 'NT-SCOUT-M01',
    questions: [
      one(
        'Le scoutisme est un mouvement éducatif pour les jeunes fondé sur :',
        no('l’obligation scolaire'),
        ok('le volontariat'),
        no('l’appartenance politique'),
        no('la sélection sportive'),
      ),
      trueFalse(
        'Le scoutisme est un mouvement apolitique, sans distinction d’origine et de croyance.',
        true,
      ),
      one(
        'En quelle année a eu lieu le premier camp scout expérimental sur l’île de Brownsea ?',
        no('1857'),
        ok('1907'),
        no('1920'),
        no('1937'),
      ),
      one(
        'Quel est l’emblème du scoutisme ?',
        no('L’étoile or'),
        no('La boussole'),
        ok('La fleur de lys'),
        no('Le foulard'),
      ),
      one(
        'Que signifie le sigle OMMS ?',
        ok('Organisation Mondiale du Mouvement Scout'),
        no('Organisation Mondiale des Mouvements Sportifs'),
        no('Office Militaire du Mouvement Scout'),
        no('Ordre Mondial des Messagers Scouts'),
      ),
      one(
        'Selon le document « Base du scoutisme », en quelle année le scoutisme est-il arrivé en Côte d’Ivoire ?',
        no('1907'),
        no('1918'),
        no('1920'),
        ok('1937'),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M02',
    questions: [
      many(
        'Quels sont les trois principes scouts ?',
        ok('Principe spirituel (devoir envers Dieu)'),
        ok('Principe social (devoir envers les autres)'),
        ok('Principe personnel (devoir envers soi-même)'),
        no('Principe sportif'),
        no('Principe politique'),
      ),
      many(
        'Quelles sont les trois vertus scoutes ?',
        ok('Franchise'),
        no('Richesse'),
        ok('Dévouement'),
        no('Force'),
        ok('Pureté'),
      ),
      one('Combien d’articles compte la loi scoute ?', no('3'), no('8'), ok('10'), no('12')),
      one(
        'Complète le premier article : « Le scout met son honneur à… »',
        no('être le premier'),
        ok('mériter confiance'),
        no('commander les autres'),
        no('gagner'),
      ),
      trueFalse(
        'Selon la loi scoute, le scout est l’ami de tous et le frère de tout autre scout.',
        true,
      ),
      one(
        'Le principe social correspond au devoir envers :',
        no('Dieu'),
        no('soi-même'),
        ok('les autres'),
        no('la nature'),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M03',
    questions: [
      one('Sur combien d’éléments repose la méthode scoute ?', no('3'), no('5'), ok('8'), no('10')),
      many(
        'Lesquels font partie des éléments de la méthode scoute ?',
        ok('La loi et la promesse'),
        ok('La vie en petit groupe'),
        no('La compétition entre équipes'),
        ok('La vie en nature'),
        no('Le classement des scouts'),
      ),
      trueFalse('La progression personnelle est l’un des éléments de la méthode scoute.', true),
      one(
        'Quel élément de la méthode désigne l’accompagnement par des adultes ?',
        no('Le cadre symbolique'),
        ok('Le soutien adulte'),
        no('L’engagement communautaire'),
        no('L’éducation par l’action'),
      ),
    ],
  },
  {
    moduleKey: 'NT-SCOUT-M04',
    questions: [
      one(
        'Qui est cité comme inventeur du code Morse, dans les années 1830 ?',
        ok('Samuel Morse, avec Alfred Vail'),
        no('Robert Baden-Powell'),
        no('Nikola Tesla'),
        no('Olave Baden-Powell'),
      ),
      one('Comment s’écrit la lettre S ?', ok('· · ·'), no('— — —'), no('· —'), no('— · —')),
      one('Comment s’écrit la lettre O ?', no('· · ·'), no('· — ·'), ok('— — —'), no('— ·')),
      one(
        'La lettre E correspond à :',
        ok('un seul point'),
        no('un seul trait'),
        no('deux points'),
        no('un point et un trait'),
      ),
      trueFalse('Le signal de détresse SOS s’écrit · · · — — — · · ·.', true),
      one(
        'Que signifie l’abréviation « K » ?',
        no('Fin de communication'),
        ok('Invitation à transmettre (« À vous »)'),
        no('Merci'),
        no('Bonne nuit'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M03',
    questions: [
      one(
        'À quels jeunes s’adresse généralement la Branche Route ?',
        no('De 12 à 15 ans'),
        no('De 15 à 18 ans'),
        ok('De 18 à 21 ans'),
        no('De 21 à 25 ans'),
      ),
      trueFalse('La Route est un espace de transition ou d’attente entre deux branches.', false),
      one(
        'Pour Baden-Powell, faire la Route, c’est :',
        no('vagabonder sans but'),
        ok('rechercher sa voie avec un objectif défini, en connaissant les difficultés'),
        no('suivre un chef sans poser de questions'),
        no('réaliser un exploit sportif'),
      ),
      one(
        'Le coordinateur de communauté est :',
        no('un chef qui commande'),
        no('un animateur qui occupe'),
        ok('un accompagnateur adulte, garant du cadre et du sens'),
        no('un arbitre qui classe les routiers'),
      ),
      one(
        'Au terme du parcours, le routier sert :',
        no('parce qu’on le lui propose'),
        no('pour obtenir une étoile'),
        ok('parce qu’il l’a choisi'),
        no('uniquement pendant les camps'),
      ),
      many(
        'La progression permet une croissance :',
        ok('individuelle (responsabilité, engagement, vocation)'),
        ok('collective (équipe, communauté, projets)'),
        no('financière'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M04',
    questions: [
      one(
        'Dans quel ordre se succèdent les étapes du parcours routier ?',
        no('Apprentissage, Noviciat, Compagnonnage, Départ routier'),
        ok('Noviciat, Apprentissage, Compagnonnage, Départ routier'),
        no('Noviciat, Compagnonnage, Apprentissage, Départ routier'),
        no('Compagnonnage, Apprentissage, Noviciat, Départ routier'),
      ),
      one(
        'Quelle est la durée générale du Noviciat ?',
        ok('Un mois'),
        no('Six mois'),
        no('Dix mois'),
        no('Une année scoute'),
      ),
      one(
        'Quelle est la durée générale du Compagnonnage ?',
        no('Un mois'),
        no('Six mois'),
        ok('Dix mois'),
        no('Une année scoute'),
      ),
      one(
        'Quel signe marque la fin du Noviciat ?',
        ok('Le flot gris'),
        no('Le flot marron'),
        no('Le flot routier'),
        no('L’étoile or'),
      ),
      one(
        'Quand a lieu la cérémonie d’accueil ?',
        no('À la fin de la quatrième étape'),
        ok('De 1 à 15 jours après l’arrivée'),
        no('À chaque fin d’étape'),
        no('Au 21e anniversaire'),
      ),
      trueFalse('Réussir un questionnaire change automatiquement l’étape officielle.', false),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M05',
    questions: [
      trueFalse('La vie en petit groupe est l’un des huit éléments de la méthode scoute.', true),
      one(
        'Pendant l’apprentissage, le routier passe :',
        ok('de la participation à l’implication'),
        no('de l’implication à la participation'),
        no('du service au repos'),
        no('de l’équipe à l’action solitaire'),
      ),
      many(
        'Selon le manuel, pendant l’apprentissage, le routier apprend à :',
        ok('agir et persévérer'),
        ok('assumer des engagements'),
        ok('mesurer les conséquences de ses choix'),
        no('éviter toute responsabilité'),
      ),
      one(
        'À quelle étape le routier commence-t-il à se former au leadership partagé ?',
        no('Noviciat'),
        ok('Apprentissage'),
        no('Départ routier'),
        no('Après la sortie de la branche'),
      ),
      one(
        'Le premier article de la loi scoute dit :',
        ok('« Le scout met son honneur à mériter confiance. »'),
        no('« Le scout obéit sans réplique. »'),
        no('« Le scout est économe. »'),
        no('« Le scout est courtois et chevaleresque. »'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M06',
    questions: [
      trueFalse('L’Engagement routier est un passage automatique.', false),
      one(
        'Par l’engagement, le routier choisit librement d’adhérer à l’idéal de la Route et de vivre selon :',
        ok('la Charte de la branche'),
        no('le règlement de son école'),
        no('les consignes de son équipe uniquement'),
        no('le programme annuel'),
      ),
      one(
        'Quel attribut est associé à l’Engagement ?',
        no('Le flot gris'),
        ok('L’insigne routier'),
        no('L’étoile blanche'),
        no('La Bible'),
      ),
      one(
        'Quand a lieu la remise des flots ?',
        no('De 1 à 15 jours après l’arrivée'),
        no('Une seule fois, au départ'),
        ok('À chaque fin d’étape'),
        no('Chaque mois'),
      ),
      many(
        'Quels objets figurent lors de la cérémonie de remise des flots ?',
        ok('Les flots'),
        ok('L’étendard'),
        no('La boussole'),
        no('La bougie'),
      ),
      trueFalse(
        'La remise des flots doit toujours être accompagnée d’une explication claire de leur signification.',
        true,
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M07',
    questions: [
      one(
        'Le Mini-Camp est :',
        no('une activité itinérante vécue seul'),
        ok('un temps de vie communautaire prolongée, généralement sur quelques jours'),
        no('un projet répondant à un besoin de la société'),
        no('une cérémonie de fin d’étape'),
      ),
      one(
        'Qui prépare et organise le Mini-Camp ?',
        no('Le coordinateur seul'),
        no('L’aumônier'),
        ok('Les routiers eux-mêmes'),
        no('Les parents'),
      ),
      many(
        'Que répartissent les routiers pour organiser le Mini-Camp ?',
        ok('L’intendance'),
        ok('L’animation'),
        ok('Les rôles'),
        ok('Le budget'),
        no('Les flots'),
      ),
      one(
        'Quel attribut est associé au Mini-Camp ?',
        ok('L’étoile marron'),
        no('L’étoile blanche'),
        no('L’étoile or'),
        no('Le flot gris'),
      ),
      trueFalse(
        'Le coordinateur veille à l’équilibre entre action, formation et temps spirituels.',
        true,
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M08',
    questions: [
      one(
        'Le Raid est :',
        ok('une activité itinérante, vécue individuellement ou en petite équipe'),
        no('un temps de vie communautaire sur place'),
        no('un projet collectif au service de la société'),
        no('une compétition entre équipes'),
      ),
      trueFalse(
        'Le Raid est un défi sportif où l’on peut se mettre en danger pour se dépasser.',
        false,
      ),
      many(
        'Que doit comporter la préparation du Raid ?',
        ok('Un itinéraire réaliste'),
        ok('Des règles de sécurité claires'),
        ok('Des objectifs éducatifs définis'),
        ok('Des temps de relecture prévus à l’issue'),
        no('Un classement des participants'),
      ),
      one(
        'Combien de temps le compagnonnage consacre-t-il à la préparation du Raid (durée générale) ?',
        no('Un mois'),
        ok('Deux mois'),
        no('Six mois'),
        no('Huit mois'),
      ),
      one(
        'Quel attribut est associé au Raid ?',
        no('L’étoile marron'),
        ok('L’étoile blanche'),
        no('L’étoile or'),
        no('L’insigne routier'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M09',
    questions: [
      one(
        'L’Entreprise est :',
        no('une activité de loisir de l’équipe'),
        ok('un projet collectif structuré qui répond à un besoin réel de la société'),
        no('un stage professionnel individuel'),
        no('une cérémonie de fin d’étape'),
      ),
      one(
        'Quelle est la première étape d’une Entreprise ?',
        ok('L’analyse du besoin'),
        no('La réalisation'),
        no('Le bilan'),
        no('La planification'),
      ),
      one(
        'Quelle étape vient juste après la réalisation ?',
        no('La planification'),
        no('La définition des objectifs'),
        ok('L’évaluation'),
        no('L’analyse du besoin'),
      ),
      trueFalse('Le coordinateur dirige l’Entreprise à la place des routiers.', false),
      one(
        'Quelle reconnaissance est associée à l’Entreprise ?',
        no('L’étoile or'),
        no('La Bible'),
        ok('Un label de domaine d’action'),
        no('L’insigne routier'),
      ),
      one(
        'Le compagnonnage fait passer le routier :',
        ok('du faire au transmettre'),
        no('du transmettre au faire'),
        no('de l’équipe à la solitude'),
        no('de l’action à l’observation'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M10',
    questions: [
      one(
        'Combien de domaines d’action le manuel présente-t-il ?',
        no('5'),
        no('8'),
        ok('10'),
        no('12'),
      ),
      one(
        'Le programme Plastic Tide Turners est associé au domaine :',
        ok('Environnement'),
        no('Santé et sport'),
        no('Art et culture'),
        no('TIC'),
      ),
      one(
        'Le programme Safe from Harm est associé au domaine :',
        no('Développement social'),
        ok('Éducation et protection de l’enfance'),
        no('Vie et foi'),
        no('Agro-pastorale'),
      ),
      one(
        'Le programme Patrimonito est associé au domaine :',
        no('Environnement'),
        no('Éducation à la paix'),
        ok('Art et culture'),
        no('Santé et sport'),
      ),
      one(
        'Les actions de solidarité, d’inclusion sociale et de lutte contre la pauvreté relèvent du domaine :',
        ok('Développement social'),
        no('Éducation à la paix'),
        no('TIC'),
        no('Agro-pastorale'),
      ),
      trueFalse(
        'Le domaine « Vie et foi » se vit dans le respect des convictions de chacun.',
        true,
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M11',
    questions: [
      one(
        'À l’étape du Départ routier, le service est :',
        no('une suite d’actions ponctuelles imposées'),
        ok('un choix personnel et durable d’engagement au service des autres'),
        no('un projet collectif de l’équipe uniquement'),
        no('une obligation de quelques jours'),
      ),
      many(
        'Le service personnel peut être :',
        ok('associatif'),
        ok('social'),
        ok('ecclésial'),
        ok('citoyen'),
        no('commercial'),
      ),
      trueFalse('Le Départ routier peut se vivre soit en branche, soit dans une ONG.', true),
      one(
        'Quel attribut est associé au Service ?',
        no('L’étoile blanche'),
        no('L’étoile marron'),
        ok('L’étoile or'),
        no('Le flot routier'),
      ),
      one(
        'Qu’est-ce qui soutient le cheminement du service ?',
        ok('Des temps d’accompagnement, de relecture et de témoignage'),
        no('Un classement des services rendus'),
        no('Un contrôle hebdomadaire des présences'),
        no('Rien : le routier est seul'),
      ),
    ],
  },
  {
    moduleKey: 'NT-ROUTE-M12',
    questions: [
      trueFalse(
        'Le départ routier est une fin : le routier quitte simplement la communauté.',
        false,
      ),
      one(
        'Quand a lieu la cérémonie de départ ?',
        no('À chaque fin d’étape'),
        no('De 1 à 15 jours après l’arrivée'),
        ok('À la fin de la quatrième étape'),
        no('Au début du compagnonnage'),
      ),
      many(
        'Quels objets et symboles figurent lors de la cérémonie de départ ?',
        ok('La Bible'),
        ok('La boussole'),
        ok('La bougie'),
        ok('L’étendard'),
        no('Les flots'),
      ),
      one(
        'Quel acteur est présent à la cérémonie de départ mais pas à la cérémonie d’accueil ?',
        no('L’aumônier'),
        no('Les équipes'),
        no('La maîtrise routier'),
        ok('Le parrain'),
      ),
      one(
        'Quel attribut est associé à l’Envoi ?',
        ok('La Bible'),
        no('L’étoile or'),
        no('Le foulard'),
        no('Le flot gris'),
      ),
    ],
  },
];
