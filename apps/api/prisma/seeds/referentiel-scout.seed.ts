/**
 * Référentiel scout (D220) : contenus fournis par le responsable, importés comme brouillons de
 * textes fondamentaux (D125) par l'import documentaire commun (`source-modules.ts`). Aucune
 * approbation ni publication : le responsable plein relit, puis publie par le circuit habituel.
 *
 * - Cérémonial de la Route : transcription **visuelle** fidèle du PDF protégé fourni (copie du texte
 *   interdite par le document ; aucune protection contournée), dans l'ordre du document. Répliques,
 *   indications scéniques et notes suivent les conventions lues par `parseCeremony` (@tesla/shared).
 * - Prière scoute : texte transmis par le responsable, reproduit à l'identique.
 *
 * Contenus attendus et **jamais inventés** : Charte des routiers, Chant de la Promesse, L'Appel de la
 * Route, La Légende du feu, enregistrements audio. Ils s'ajoutent depuis l'application.
 */
import { createHash } from 'node:crypto';
import {
  type LessonBlock,
  type LessonDocument,
  type LessonInline,
  type SourceEditorialNote,
} from '@tesla/shared';
import { type SourceModule } from './source-modules.js';

const THEME = 'Référentiel scout';

const t = (value: string): LessonInline => ({ type: 'text', text: value });
const b = (value: string): LessonInline => ({
  type: 'text',
  text: value,
  marks: [{ type: 'bold' }],
});
const p = (value: string): LessonBlock => ({ type: 'paragraph', content: [t(value)] });
const h2 = (value: string): LessonBlock => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [t(value)],
});
/** Réplique : intervenant en gras suivi de « : », puis les paroles. */
const say = (speaker: string, words: string): LessonBlock => ({
  type: 'paragraph',
  content: [b(`${speaker} :`), t(` ${words}`)],
});
/** Indication scénique (une ou plusieurs lignes du même encadré). */
const dir = (...lines: string[]): LessonBlock => ({ type: 'blockquote', content: lines.map(p) });
const ul = (...values: string[]): LessonBlock => ({
  type: 'bulletList',
  content: values.map((value) => ({ type: 'listItem', content: [p(value)] })),
});
const nb = (value: string): LessonBlock => ({
  type: 'paragraph',
  content: [b('NB :'), t(` ${value}`)],
});
const ref = (pages: string): LessonBlock =>
  p(`Référence : Boussole Pédagogique Scoute_Route, ${pages}.`);
const doc = (...content: LessonBlock[]): LessonDocument => ({ type: 'doc', content });
const note = (
  kind: SourceEditorialNote['kind'],
  lessonPosition: number | null,
  value: string,
): SourceEditorialNote => ({ kind, lessonPosition, note: value });

const PREPARATION = 'Préparation';
const DEROULE = 'Déroulé et paroles';
const REPAS = 'Un cocktail ou un repas peut être offert à tous en l’honneur du Routier.';
const PREP_FLOTS =
  'La remise de flots se fait en tenue officielle et au cours d’un rassemblement de type rectangle.';
const FIN_FLOTS =
  'Le routier récipiendaire fléchit le genou gauche et les flots sont placés sur l’épaule gauche. Le routier se relève et rejoint son équipe et la communauté lance un cri puis entonne un chant de réjouissance.';
const NB_ETOILES =
  'Les étoiles sont disposées sur la couverture de la poche gauche dans l’ordre de la droite vers la gauche (Marron – Blanc – Dorée).';

// ─── Cérémonial de la Route ────────────────────────────────────────────────

export const CEREMONIAL_KEY = 'NT-TXT-CEREMONIAL-ROUTE';
export const CEREMONIAL_SLUG = 'ceremonial-de-la-route';
/** SHA-256 du PDF fourni (`docs/sources/Ceremonial_de_la_Route_Nikola_Tesla_protege.pdf`). */
export const CEREMONIAL_PDF_SHA256 =
  'b1e0981db5d1370433af05a4a04dfc20be3bbc13802e12e8b451ccf3483f5576';

const ACCUEIL = doc(
  ref('pp. 56–57'),
  h2(PREPARATION),
  p(
    'La cérémonie d’accueil se fait deux semaines après l’arrivée du jeune à la communauté, qu’il vienne de la génération ou pas. La communauté fait un rassemblement en rectangle.',
  ),
  h2(DEROULE),
  say('Le CC', 'À l’aise !!! Route pour…'),
  say('Les routiers en rectangle', 'SERVIR !'),
  say('Le CC', 'À l’aise !'),
  say(
    'Le CC (s’adressant au CC adjoint ou assistant)',
    'Chef, nous avons un nouveau parmi nous, amène-le-moi.',
  ),
  dir(
    'Le CCA ou l’ACC le place au milieu du rectangle. (Le nouveau devra être hors du rassemblement.)',
  ),
  say(
    'Le CC',
    'Tu as manifesté ton désir d’appartenir à la route pour vivre son idéal en particulier et celui du scoutisme en général. Et bien sache que tu as désormais une famille car nous t’acceptons et te souhaitons le traditionnel Akwaba parmi nous. Bonne arrivée et que vive la route.',
  ),
  say('Le CC', 'À l’aise !! Route pour…'),
  say('Les routiers', 'SERVIR !'),
  dir(
    'Le CC porte au nouveau routier le foulard de la route, symbole de son adhésion à la communauté et met tout le monde à l’aise !',
    'Le novice (nouveau routier) salue toutes les personnes présentes dans le rassemblement.',
    'L’un des délégués lance un cri de joie et entonne des chants pour dire bienvenue au nouveau.',
  ),
  nb(REPAS),
);

const ENGAGEMENT = doc(
  ref('pp. 58–59'),
  h2(PREPARATION),
  p(
    'Pour le jeune qui vient d’arriver pour la première fois au mouvement scout, cette cérémonie fera office de cérémonie de promesse. Les cheminots venant de la Génération, au travers de cette cérémonie, renouvelleront leur promesse scoute.',
  ),
  h2(DEROULE),
  say('CC', 'À l’appel de son nom, le Postulant s’avance. Que désires-tu ?'),
  say('Le Postulant', 'Devenir Routier de Côte d’Ivoire.'),
  say('CC', 'Es-tu prêt à faire ton engagement routier ?'),
  say('Le Postulant', 'Oui chef.'),
  say(
    'CC',
    'Tu n’ignores pas que l’engagement Routier que tu vas prononcer est l’engagement de toute une vie ?',
  ),
  say('Le Postulant', 'Oui, j’ai bien réfléchi là-dessus.'),
  say(
    'CC (s’adressant aux autres Routiers)',
    'Êtes-vous tous d’accord pour admettre définitivement (nom du postulant) pour qu’il fasse maintenant son engagement routier ?',
  ),
  say('Tous les routiers', 'Oui chef.'),
  dir(
    'Le Coordinateur de Communauté demande au porte Enseigne de s’avancer, celui-ci s’avance auprès du postulant et tend la hampe de l’enseigne à l’horizontale, de façon à ce que la pièce d’étoffe tombe vers le bas comme un rideau, sans toucher terre.',
  ),
  say(
    'CC',
    'Tu peux maintenant t’avancer vers moi et prononcer la formule qui, officiellement, fera de toi un Routier digne de ce nom et un scout reconnu partout dans le monde.',
  ),
  dir('Le postulant s’avance et pose sa main gauche sur la hampe et fait le salut scout.'),
  say('Le Postulant', 'Sur mon honneur et avec la grâce de Dieu :'),
  ul(
    'Moi (il se nomme) je m’engage à servir de mon mieux Dieu, l’Église et ma patrie ;',
    'À aider mon prochain en toute circonstance ;',
    'Et à vivre selon la loi scoute et la Charte des Routiers.',
  ),
  say('CC (donnant la poignée de main scoute au nouveau Routier)', 'Toutes mes félicitations !'),
  dir(
    'Il remet alors l’insigne de l’Engagement au nouveau Routier.',
    'Le Postulant salue et fait le tour de l’assistance, et donne la poignée de main scoute à tous les autres Routiers, ainsi qu’aux animateurs.',
    'On adresse ensemble un ban de félicitations au nouveau Routier et on chante le chant de la « Promesse scoute ».',
  ),
  nb(REPAS),
);

const DEPART = doc(
  ref('pp. 60–62'),
  h2(PREPARATION),
  p(
    'Voici le cérémonial de départ que l’on retrouve dans le manuel « Cérémonial » rédigé en 1954. Il a été revu et actualisé avec de légères modifications. La cérémonie doit revêtir un aspect solennel et il est indispensable qu’elle se passe en plein air, de préférence la nuit tombée avec des flambeaux, par exemple au camp, à la croisée de deux chemins, etc. Mais la liberté reste entière à chaque Maîtrise d’organiser le Départ de ses Routiers quant au lieu du rassemblement et l’ambiance de la cérémonie. Les routiers sont rassemblés en rectangle et en uniforme impeccable face à la Maîtrise. Deux novices Routiers, l’un portant le Drapeau National, l’autre portant l’Enseigne de la Communauté, se tiennent de part et d’autre de la maîtrise.',
  ),
  h2(DEROULE),
  say(
    'Le Compagnon Routier',
    'Chef, s’il plaît à Dieu et à vous, je demande à faire mon Départ Routier.',
  ),
  say(
    'CC',
    'Tu as choisi d’être Routier. Souhaites-tu maintenant prendre ton départ vers la Route des Hommes ?',
  ),
  say('Le Compagnon Routier', 'Oui Chef.'),
  say(
    'CC',
    'Sais-tu que pour vivre dans l’Idéal tu dois t’imposer une discipline de vie et éviter d’être l’esclave du confort et de tes envies, et que tu dois rester simple, droit et vrai ?',
  ),
  say('Le Compagnon Routier', 'Oui Chef, je le sais.'),
  say(
    'CC',
    'Promets-tu d’approfondir tes convictions et ta Foi en témoignant d’elles, en étant en service dans la communauté des hommes, en restant attentif aux besoins de notre mouvement et surtout en ayant pour chaque mot, l’acte qui compte et qui engage ?',
  ),
  say('Le Compagnon Routier', 'Oui, je le promets.'),
  say(
    'CC',
    'Veux-tu en toutes choses, rechercher la vérité et la servir librement, sans écraser les autres de ta découverte ?',
  ),
  say('Le Compagnon Routier', 'Je le veux.'),
  say(
    'CC',
    'T’engages-tu à essayer de lire d’abord en tout être la richesse qu’il porte en lui et qui le rend unique, et tout en découvrant ses faiblesses, accepter les autres tels qu’ils sont afin de les respecter, mais en ayant aussi la ferme volonté de faire respecter en quoi tu crois ?',
  ),
  say('Le Compagnon Routier', 'Je le promets.'),
  say(
    'CC',
    'Tu es donc décidé à t’engager sur la route des hommes et y progresser pour être au service de tes frères.',
  ),
  say('Le Compagnon Routier', 'Oui, je le veux de toutes mes forces et avec l’aide de Dieu.'),
  say(
    'CC',
    'Que ta conviction et tes frères t’aident à persévérer dans ton engagement. Que l’argent, les honneurs et autres futilités n’émoussent pas ta vocation. Renouvelle maintenant ton Serment afin qu’il te guide dans ton choix de service, pour qu’elle te soutienne dans ton nouveau choix.',
  ),
  dir(
    'L’Enseigne s’incline alors devant le Scout Routier.',
    'Le Compagnon Routier s’avance d’un pas, place la main gauche sur l’Enseigne, lève la main droite, au signe scout et dit :',
  ),
  say(
    'Le Compagnon Routier',
    'J’ai promis sur mon honneur et avec la grâce de Dieu de servir de mon mieux Dieu, l’Église et ma patrie, d’aider mon prochain en toutes circonstances et d’observer la Loi Scoute et la Charte des Routiers.',
  ),
  p('Et je promets en outre :'),
  ul(
    'De vivre plus intégralement ma foi catholique,',
    'De remplir plus loyalement mes obligations de scout,',
    'D’être solidaire et attentif aux autres,',
    'De mettre en pratique de mon mieux dans mon quotidien, l’esprit scout,',
    'D’être un bon citoyen.',
  ),
  say(
    'CC',
    'Sois un Routier en marche dans la Communauté des Hommes. Reçois maintenant, frère, cet insigne qui montrera à tous que tu es un Routier Scout de l’Association des Scouts Catholiques de Côte d’Ivoire.',
  ),
  dir(
    'Le CC lui remet les flots de couleur jaune, vert, orange et rouge symbolisant les 4 branches de l’ASCCI et signe de l’aînesse.',
  ),
  say('CC', 'Et maintenant, tu peux partir, la Route est ouverte.'),
  dir('Le Routier s’avance vers l’Aumônier et fléchit le genou en disant :'),
  say('Le Compagnon Routier', 'Père, je ne partirai pas avant que vous ne m’ayez béni.'),
  dir(
    'L’Aumônier dégage la signification de la cérémonie pour le cas particulier du Routier qui prend son départ. Il peut s’inspirer du texte ci-dessous :',
  ),
  say(
    'Aumônier',
    'Mon Fils, comme le Divin Maître à ses Apôtres, je te dirai : Va ; maintenant aux brebis perdues de la maison d’Israël et dis-leur : « Le Royaume de Dieu est proche ».',
  ),
  p(
    'Tous les dons de la grâce et de la nature tu les as reçus gratuitement ; passe-les aux autres gratuitement. Ne porte en route ni or, ni argent, ni monnaie dans ta ceinture ; ne prends pas ton bâton pour arme mais seulement pour soutien de fatigue. Là où tu t’arrêteras, salue en disant : « Que la paix soit sur cette maison ». Soit prudent comme le serpent et pur comme la colombe.',
  ),
  p(
    'Passe sur la Route en faisant le bien et efforce-toi de vivre de telle sorte que Notre-Seigneur puisse dire que celui qui te reçoit le reçoit Lui-même. Que Notre-Dame, l’Étoile du matin, te guide ; que l’Archange Raphaël te protège ; que Saint-Paul t’escortent et que la bénédiction de Dieu Tout puissant, Père, Fils et Saint-Esprit descende sur toi et y demeure à jamais.',
  ),
  say('Le Compagnon Routier', 'Amen.'),
  dir('Le parrain lui donne alors l’accolade au nom de la Communauté.'),
  say('CC', 'Bonne route frère. À Dieu va !'),
  dir(
    'Le Compagnon Routier salue la maîtrise, puis tandis qu’il se retourne pour saluer le reste de la communauté, les Routiers s’écartent et ouvrent la route.',
    'Au commandement du Coordinateur Adjoint, la communauté entière répond au salut du nouveau Routier Scout pendant que celui-ci avance sur la route libre.',
    'La communauté, sitôt remise au « Toujours Prêt » par l’assistant, chante « L’Appel de la Route » tandis que le nouveau Routier Scout s’éloigne du rassemblement.',
  ),
  nb(REPAS),
);

const FLOTS_GRIS = doc(
  ref('pp. 63–65'),
  h2(PREPARATION),
  p(
    `${PREP_FLOTS} Le délégué d’équipe informe la maîtrise routier de la fin de la première étape (le noviciat) pour un membre.`,
  ),
  h2(DEROULE),
  say(
    'Délégué',
    'Chef, un membre de l’équipe (nom de l’équipe) a achevé le déroulement de son étape de noviciat et souhaite la clôture de celle-ci par la remise de flots.',
  ),
  say('Coordinateur', 'Qui est-il ?'),
  dir('Le délégué appelle le concerné qui avance d’un pas.'),
  say('Coordinateur', 'Route pour…'),
  say('La communauté', 'Servir !'),
  say(
    'Coordinateur',
    'Tu as terminé l’étape de noviciat. Tu as connu la route, tu l’as découverte. As-tu apprécié le temps passé ?',
  ),
  say('Routier récipiendaire', 'Oui chef !'),
  say('Coordinateur', 'Veux-tu continuer la route avec nous ?'),
  say('Routier récipiendaire', 'Oui chef !'),
  say('Coordinateur', 'Quelle valeur as-tu appris ?'),
  say('Routier récipiendaire', 'Humilité !'),
  say(
    'Coordinateur',
    'Nous t’admettons donc à recevoir les flots gris, symbole d’humilité et qui clôt officiellement l’étape de noviciat.',
  ),
  dir(FIN_FLOTS),
);

const FLOTS_MARRONS = doc(
  ref('pp. 66–67'),
  h2(PREPARATION),
  p(
    `${PREP_FLOTS} Le délégué d’équipe informe la maîtrise routier de la fin de l’étape d’apprentissage.`,
  ),
  h2(DEROULE),
  say(
    'Délégué',
    'Chef, un membre de l’équipe (nom de l’équipe) a achevé le déroulement de son étape d’apprentissage et souhaite la clôture de celle-ci par la remise de flots.',
  ),
  say('Coordinateur', 'Qui est-il ?'),
  dir('Le délégué appelle le concerné qui avance d’un pas.'),
  say('Coordinateur', 'Route pour…'),
  say('La communauté', 'Servir !'),
  say(
    'Coordinateur',
    'Tu as terminé l’étape d’apprentissage. Tu as fait route avec tes amis, tu as réalisé le but et tu l’as mis en pratique, tu as servi la communauté et ton engagement en a été le symbole le plus fort. As-tu apprécié l’expérience vécue ?',
  ),
  say('Routier récipiendaire', 'Oui chef !'),
  say(
    'Coordinateur',
    'Veux-tu passer à une nouvelle étape, à un autre niveau du service à la communauté ?',
  ),
  say('Routier récipiendaire', 'Oui chef !'),
  say('Coordinateur', 'Quelles valeurs as-tu appris durant ton apprentissage ?'),
  say('Routier récipiendaire', 'Le service aux autres, la charité !'),
  say(
    'Coordinateur',
    'Nous t’admettons donc à recevoir les flots marrons, symbole de charité et d’humanisme et qui clôt officiellement l’étape d’apprentissage.',
  ),
  dir(FIN_FLOTS),
);

const FLOTS_ROUTIERS = doc(
  ref('pp. 68–69'),
  h2(PREPARATION),
  p(
    `${PREP_FLOTS} Le délégué d’équipe informe la maîtrise routier de la fin de l’étape d’apprentissage [mention figurant sur la page de présentation ; le dialogue ci-dessous indique le compagnonnage].`,
  ),
  h2(DEROULE),
  say(
    'Délégué',
    'Chef, un membre de l’équipe (nom de l’équipe) a achevé le déroulement de son étape de compagnonnage et souhaite la clôture de celle-ci par la remise de flots routiers.',
  ),
  say('Coordinateur', 'Qui est-il ?'),
  dir('Le délégué appelle le concerné qui avance d’un pas.'),
  say('Coordinateur', 'Route pour…'),
  say('La communauté', 'Servir !'),
  say(
    'Coordinateur',
    'Tu as terminé l’étape de compagnonnage. Tu as œuvré au bien-être de la communauté dans le respect des prescriptions scoutes, tu as réalisé des entreprises pour aider les autres. Qu’as-tu appris durant cette période ?',
  ),
  say('Routier récipiendaire', 'Le dévouement !'),
  say('Coordinateur', 'As-tu compris pourquoi tu le faisais ?'),
  say(
    'Routier récipiendaire',
    'Oui chef ! Pour le bien-être des autres et pour un monde un peu plus meilleur.',
  ),
  say('Coordinateur', 'Es-tu prêt à partager ton expérience et la faire profiter aux autres ?'),
  say('Routier récipiendaire', 'Oui Chef !'),
  say(
    'Coordinateur',
    'Nous t’admettons donc à recevoir les flots routiers caractérisés par les couleurs des quatre branches. Tu devras donc partager cette expérience acquise avec tes cadets avec la période de service qui s’ouvre par cette occasion.',
  ),
  dir(FIN_FLOTS),
);

const ETOILES_REF = 'page suivant la p. 69';

const ETOILE_MARRON = doc(
  ref(ETOILES_REF),
  say(
    'Coordinateur',
    'À la suite de ce mini-camp où nous avons pris la peine de t’observer et de te voir à l’œuvre apportant aide et assistance aux personnes et communautés dans le besoin, la maîtrise routier te décerne cette étoile de couleur Marron qui symbolise l’expérience acquise durant cette étape d’apprentissage.',
  ),
  p('Continue sur la route choisie et fais cœur avec tes frères pour toujours aider les autres.'),
  p(
    'Reçois cette étoile, gage de la reconnaissance et de l’expérience que tu pourras désormais faire valoir.',
  ),
  nb(NB_ETOILES),
);

const ETOILE_BLANCHE = doc(
  ref(ETOILES_REF),
  say(
    'Coordinateur',
    'Le blanc est un symbole de pureté et de sacrifice. Durant cette journée, tu as fait montre de cet esprit pur et de ce sacrifice à travers cette marche qui a été meublée par des actions envers les autres et pour les autres. Telle est la mission du routier et tu l’as démontré.',
  ),
  p(
    'La maîtrise routier te remet cette étoile Blanche pour marquer ce moment et te rappeler ton engagement à servir sans rien attendre en retour.',
  ),
  nb(NB_ETOILES),
);

const ETOILE_DOREE = doc(
  ref(ETOILES_REF),
  say(
    'Coordinateur',
    'Durant cette période, tu as appris à te dominer et à servir les autres sans le soutien de ton équipe comme il était demandé préalablement.',
  ),
  p(
    'Tu as découvert de nouveaux environnements, tu as expérimenté de nouvelles choses et tu reviens préparer ton envoi vers la vie d’adultes.',
  ),
  p(
    'Afin de te récompenser de tous ces efforts, la maîtrise routier te décerne cette étoile, signe de bravoure et de succès.',
  ),
  nb(NB_ETOILES),
);

/** Les neuf cérémonies, dans l'ordre du document (une fiche par cérémonie). */
export const CEREMONY_LESSONS = [
  { title: 'La cérémonie d’accueil', content: ACCUEIL },
  { title: 'La cérémonie de l’engagement routier', content: ENGAGEMENT },
  { title: 'La cérémonie du départ routier', content: DEPART },
  { title: 'Cérémonie de remise des flots gris', content: FLOTS_GRIS },
  { title: 'Cérémonie de remise des flots marrons', content: FLOTS_MARRONS },
  { title: 'Cérémonie de remise des flots routiers', content: FLOTS_ROUTIERS },
  { title: 'Cérémonie de remise de l’étoile marron', content: ETOILE_MARRON },
  { title: 'Cérémonie de remise de l’étoile blanche', content: ETOILE_BLANCHE },
  { title: 'Cérémonie de remise de l’étoile dorée', content: ETOILE_DOREE },
] as const;

export const CEREMONIAL: SourceModule = {
  key: CEREMONIAL_KEY,
  slug: CEREMONIAL_SLUG,
  title: 'Cérémonial de la Route',
  summary:
    'Les cérémonies de la communauté : accueil, engagement routier, départ routier, remise des flots et des étoiles.',
  objectives: [],
  stageCode: null,
  theme: THEME,
  category: 'TEXTE_FONDAMENTAL',
  sourceDocument:
    'Cérémonial de la Route — Communauté Nikola Tesla (Scouts Catholiques de Côte d’Ivoire, Branche Route ; chapitre VII de la Boussole Pédagogique Scoute_Route), PDF transmis par le responsable le 2026-11-25',
  sourceSha256: CEREMONIAL_PDF_SHA256,
  sourcePages: 'PDF de 9 pages (Boussole : pp. 56–69 et page suivante)',
  lessons: CEREMONY_LESSONS.map((lesson) => ({ title: lesson.title, content: lesson.content })),
  notes: [
    note(
      'A_VERIFIER',
      5,
      'Divergence du document, conservée telle quelle : la préparation de la remise des flots routiers mentionne la fin de l’étape d’apprentissage, alors que le dialogue indique le compagnonnage (le PDF le signale lui-même entre crochets). À trancher par le responsable ; aucune correction silencieuse.',
    ),
    note(
      'INFORMATION',
      null,
      'Transcription visuelle des 9 pages du PDF protégé (copie du texte interdite par le document, aucune protection contournée), dans l’ordre du document. Formulations du document conservées sans correction : « Quelle valeur as-tu appris ? », « Soit prudent comme le serpent », « que Saint-Paul t’escortent », « un monde un peu plus meilleur ». Toute correction passe par une nouvelle version approuvée.',
    ),
    note(
      'INFORMATION',
      null,
      'Conventions de rédaction du référentiel : intervenant en gras suivi de « : », indications scéniques en citation, « NB : » en gras pour les notes. Elles permettent le mode « Mon rôle » et le mode cérémonie.',
    ),
    note(
      'INFORMATION',
      2,
      'La cérémonie du départ routier n’est pas la sortie administrative de la branche (calculée selon l’âge). Consulter ou préparer une cérémonie n’enregistre jamais un engagement, un flot, une étoile ni un acquis.',
    ),
    note(
      'INFORMATION',
      null,
      'La note du document sur la disposition des étoiles (fin de la partie V) est reprise dans chacune des trois fiches de remise d’étoile.',
    ),
    note(
      'A_COMPLETER',
      null,
      'Chants cités, non fournis : « Promesse scoute » (engagement) et « L’Appel de la Route » (départ). Les associer à ce texte lorsqu’ils seront publiés (textes cités du module).',
    ),
  ],
};

// ─── Prière scoute ─────────────────────────────────────────────────────────

/** Texte transmis par le responsable (mission du 2026-11-25), reproduit à l'identique. */
export const PRIERE_SCOUTE_LINES = [
  'À être généreux,',
  'À vous servir comme vous le méritez,',
  'À donner sans compter,',
  'À combattre sans souci des blessures,',
  'À travailler sans chercher le repos,',
  "À nous dépenser, sans attendre d'autre récompense,",
  'Que celle de savoir que nous faisons votre sainte volonté.',
] as const;
export const PRIERE_SCOUTE_INVOCATION = 'Seigneur Jésus, apprenez-nous :';

export const PRIERE_SCOUTE_KEY = 'NT-TXT-PRIERE-SCOUTE';

export const PRIERE_SCOUTE: SourceModule = {
  key: PRIERE_SCOUTE_KEY,
  slug: 'priere-scoute',
  title: 'Prière scoute',
  summary: 'La prière scoute, texte intégral.',
  objectives: [],
  stageCode: null,
  theme: THEME,
  category: 'TEXTE_FONDAMENTAL',
  sourceDocument: 'Prière scoute — texte transmis par le responsable (mission du 2026-11-25)',
  sourceSha256: createHash('sha256')
    .update([PRIERE_SCOUTE_INVOCATION, ...PRIERE_SCOUTE_LINES].join('\n'))
    .digest('hex'),
  sourcePages: 'texte intégral',
  lessons: [
    {
      title: 'Prière scoute',
      content: doc(
        { type: 'paragraph', content: [b(PRIERE_SCOUTE_INVOCATION)] },
        ...PRIERE_SCOUTE_LINES.map(p),
      ),
    },
  ],
  notes: [
    note(
      'INFORMATION',
      null,
      'Formulation transmise par le responsable, à conserver mot pour mot (aucune autre version de la prière).',
    ),
  ],
};

/** Contenus du référentiel importés comme brouillons. */
export const REFERENCE_SOURCES: readonly SourceModule[] = [CEREMONIAL, PRIERE_SCOUTE];
