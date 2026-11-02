/**
 * Catalogue initial de formation à la Route (mission du 2026-10-30) : textes fondamentaux et modules
 * rédigés à partir du manuel « SAPF-Route » (atelier pédagogique, Région d'Abidjan, communauté Mahatma
 * Gandhi) et du document « BASE DU SCOUTISME » (paroisse Notre-Dame du Perpétuel Secours de Treichville).
 *
 * - Tout est importé en BROUILLON, jamais approuvé ni publié ; aucun questionnaire n'est créé.
 * - Le manuel est une référence pédagogique, pas un règlement national homologué : `officialSource`
 *   reste nul et aucun module n'est déclaré obligatoire.
 * - Les explications reprennent le texte des sources (pages imprimées du manuel). Les activités
 *   « Pour réfléchir » et les exemples de projets sont des ajouts éditoriaux, signalés comme tels.
 * - Un point non couvert par les sources est signalé (note « À compléter ») au lieu d'être inventé.
 * - Les modules 01 et 02 du catalogue réutilisent les brouillons NT-SCOUT-M01 et NT-SCOUT-M02 déjà
 *   importés (pas de doublon) ; voir docs/CATALOGUE_PEDAGOGIQUE_INITIAL.md.
 */
import { createHash } from 'node:crypto';
import {
  type ActionDomain,
  type LessonBlock,
  type LessonDocument,
  type SourceEditorialNote,
} from '@tesla/shared';
import { type SourceModule } from './source-modules.js';

const SAPF_DOCUMENT = 'SAPF-Route (2).pdf';
/** SHA-256 du PDF du manuel utilisé pour la rédaction. */
const SAPF_SHA256 = 'd9b0b69d96361b9fce136e1c743bb70ff639e71a521ba227e073ae8c998244f6';
const THEME = 'Formation à la Route';

// ─── Construction des documents (liste blanche de `lessonDocumentSchema`) ──

const text = (value: string, italic = false) =>
  italic
    ? { type: 'text' as const, text: value, marks: [{ type: 'italic' as const }] }
    : {
        type: 'text' as const,
        text: value,
      };
const p = (value: string): LessonBlock => ({ type: 'paragraph', content: [text(value)] });
const h = (value: string): LessonBlock => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [text(value)],
});
const items = (values: readonly string[]) =>
  values.map((value) => ({ type: 'listItem' as const, content: [p(value)] }));
const ul = (...values: string[]): LessonBlock => ({ type: 'bulletList', content: items(values) });
const ol = (...values: string[]): LessonBlock => ({ type: 'orderedList', content: items(values) });
const quote = (value: string): LessonBlock => ({ type: 'blockquote', content: [p(value)] });
/** Référence documentaire en fin de leçon. */
const sapf = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [text(`Source : manuel « SAPF-Route », ${pages}.`, true)],
});
const base = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [text(`Source : « Base du scoutisme », ${pages}.`, true)],
});
/** Activité de réflexion (ajout éditorial). */
const reflect = (...questions: string[]): LessonBlock[] => [h('Pour réfléchir'), ul(...questions)];
/** Conclusion du module (dernière leçon). */
const conclude = (...points: string[]): LessonBlock[] => [h('Pour conclure'), ul(...points)];
const doc = (...content: (LessonBlock | LessonBlock[])[]): LessonDocument => ({
  type: 'doc',
  content: content.flat(),
});

const note = (
  kind: SourceEditorialNote['kind'],
  lessonPosition: number | null,
  value: string,
): SourceEditorialNote => ({ kind, lessonPosition, note: value });

/** Notes communes aux modules rédigés d'après le manuel. */
const commonNotes = (stage: string): SourceEditorialNote[] => [
  note(
    'INFORMATION',
    null,
    `Étape recommandée « ${stage} » : proposition du catalogue initial (mission du 2026-10-30), ni obligatoire ni condition de progression. À confirmer par le responsable.`,
  ),
  note(
    'INFORMATION',
    null,
    'Rédigé d’après le manuel SAPF-Route (pages imprimées citées en fin de leçon). Le manuel est une référence pédagogique de la région, pas un règlement national homologué : aucune source officielle n’est déclarée.',
  ),
  note(
    'INFORMATION',
    null,
    'Ajouts éditoriaux à valider : rubriques « Pour réfléchir » et « Pour conclure », titres intermédiaires et reformulations de liaison.',
  ),
  note(
    'INFORMATION',
    null,
    'Questionnaire d’entraînement préparé (prisma/seeds/route-questionnaires.ts) : créé, approuvé et publié avec le module par la mise en service. Les questions « Pour réfléchir » restent des supports de relecture, jamais notées.',
  ),
];

/** Rapprochement avec un brouillon vide du catalogue « Découvrir la Route », retiré à la mise en service (D129). */
const overlap = (keys: string) =>
  note(
    'INFORMATION',
    null,
    `Sujet du ou des brouillon(s) vide(s) ${keys} (catalogue « Découvrir la Route ») : ce module en tient lieu ; les brouillons vides sont retirés à la mise en service (D129).`,
  );

// ─── Texte fondamental : Prière de la Route ────────────────────────────────

/** Texte transmis par le responsable, conservé tel quel dans la provenance. */
export const PRIERE_ROUTE_ORIGINAL =
  '« Seigneur jésus, garder notre coeur pur et notre âme curieuse, donnez nous de vous servir avec passion et de rayonner de votre joie. Rendez nous frere nous qui faisons route pour ensemble vous trouvez amen. »';

export const PRIERE_ROUTE_KEY = 'NT-TXT-PRIERE-ROUTE';

const PRIERE: SourceModule = {
  key: PRIERE_ROUTE_KEY,
  slug: 'priere-de-la-route',
  title: 'Prière de la Route',
  summary: 'Texte fondamental de la branche Route.',
  objectives: [],
  stageCode: null,
  theme: 'Textes fondamentaux',
  category: 'TEXTE_FONDAMENTAL',
  sourceDocument: 'Prière de la Route — texte transmis par le responsable (mission du 2026-10-30)',
  sourceSha256: createHash('sha256').update(PRIERE_ROUTE_ORIGINAL).digest('hex'),
  sourcePages: 'texte intégral',
  lessons: [
    {
      title: 'Prière de la Route',
      content: doc(
        p('Seigneur Jésus, gardez notre cœur pur et notre âme curieuse.'),
        p('Donnez-nous de vous servir avec passion et de rayonner de votre joie.'),
        p('Rendez-nous frères, nous qui faisons route, pour ensemble vous trouver.'),
        p('Amen.'),
      ),
    },
  ],
  notes: [
    note('INFORMATION', null, `Texte original transmis : ${PRIERE_ROUTE_ORIGINAL}`),
    note(
      'A_VERIFIER',
      0,
      'Version rédactionnelle proposée, à valider avant publication : majuscule à « Jésus », « garder » → « gardez », « coeur » → « cœur », « donnez nous » → « Donnez-nous », « Rendez nous frere » → « Rendez-nous frères », « vous trouvez » → « vous trouver », ponctuation et découpage en lignes. Toute autre formulation reconnue par la communauté prévaut.',
    ),
    note(
      'INFORMATION',
      null,
      'Texte fondamental unique : les modules le citent (lien), sans copie. Une modification passe par une nouvelle version, approuvée et publiée par le responsable ; l’historique des versions est conservé.',
    ),
  ],
};

// ─── NOVICIAT ──────────────────────────────────────────────────────────────

const M03: SourceModule = {
  key: 'NT-ROUTE-M03',
  slug: 'route-m03-decouverte-de-la-branche-route',
  title: 'Découverte de la branche Route',
  summary:
    'Ce qu’est la Route, ce qu’elle propose au jeune adulte et ce qu’elle attend de lui : responsabilité, service et vie communautaire.',
  objectives: [
    'Situer la Route comme aboutissement du parcours scout et lieu d’accomplissement.',
    'Expliquer les objectifs éducatifs de la branche.',
    'Relier responsabilité personnelle, service et vie communautaire.',
    'Connaître la Prière de la Route.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 2 à 4 et 9 ; « Base du scoutisme » p. 1 et 2',
  textLinks: [PRIERE_ROUTE_KEY],
  lessons: [
    {
      title: 'Qu’est-ce que la Route ?',
      content: doc(
        p(
          'La Branche Route constitue l’aboutissement du parcours scout du jeune. Elle s’adresse à des jeunes adultes, généralement âgés de 18 à 21 ans, engagés dans une période charnière de leur existence, où se posent les grandes questions du sens de la vie, des choix professionnels, de l’engagement dans la société et de la responsabilité personnelle.',
        ),
        p(
          'Contrairement aux branches précédentes, la Route n’est pas un espace de transition ou d’attente, mais un lieu d’accomplissement. Elle n’est ni un simple cadre d’activités, ni un prolongement ludique du scoutisme, mais un véritable itinéraire éducatif.',
        ),
        h('L’intuition de Baden-Powell'),
        quote(
          '« Par la Route, il n’entendait pas vagabonder sans but, mais rechercher sa voie le long de sentiers agréables avec un objectif défini, en se rendant compte des difficultés et des dangers que l’on pourra rencontrer en cours de route. »',
        ),
        p(
          'La Route est donc un chemin volontaire, orienté vers un but clair. Le routier y adhère librement à l’idéal de la Route et choisit de vivre selon la Charte de la branche (manuel, p. 9).',
        ),
        reflect(
          'Qu’est-ce qui t’a conduit à rejoindre la Route ?',
          'Quelle différence vois-tu entre « vagabonder sans but » et « rechercher sa voie » ?',
        ),
        sapf('p. 2 et 9'),
      ),
    },
    {
      title: 'Les objectifs éducatifs de la branche',
      content: doc(
        p(
          'La Route vise à former des adultes capables de servir, de prendre des responsabilités et de s’engager durablement dans la société.',
        ),
        p('La progression y permet une double croissance :'),
        ul(
          'une croissance individuelle : responsabilité personnelle, engagement, vocation ;',
          'une croissance collective : équipe, communauté, projets.',
        ),
        p(
          'La réussite de la Branche Route ne se mesure pas seulement au nombre de jeunes présents, mais à la qualité des adultes qui en émergent.',
        ),
        h('Rappel : l’objectif du scoutisme'),
        p(
          'Le scoutisme contribue au développement des jeunes en les aidant à réaliser pleinement leurs possibilités physiques, intellectuelles, spirituelles et sociales (« Base du scoutisme », p. 2).',
        ),
        reflect('Lequel de ces objectifs te paraît le plus exigeant pour toi aujourd’hui ?'),
        sapf('p. 2 et 3'),
      ),
    },
    {
      title: 'La responsabilité personnelle',
      content: doc(
        p(
          'La Route invite le jeune à quitter progressivement la posture de celui qui est guidé pour entrer dans celle de celui qui choisit, agit et s’engage librement.',
        ),
        p(
          'À cet âge, le jeune adulte n’accepte plus une autorité imposée ni un encadrement infantilisant. Il attend de la cohérence, du sens et de la confiance. La pédagogie de la Route y répond par un cadre exigeant mais libre, fondé sur la responsabilité, l’action concrète et l’engagement personnel.',
        ),
        p(
          'Chacun avance à son rythme, sans comparaison, mais avec des repères clairs et partagés.',
        ),
        h('Le rôle de l’encadrement'),
        p(
          'Le coordinateur de communauté n’est ni un chef qui commande, ni un animateur qui occupe : c’est un accompagnateur adulte, garant du cadre et du sens. Il accompagne sans se substituer, encourage sans diriger, et rappelle le cap lorsque l’essentiel se dilue.',
        ),
        reflect(
          'Dans quelle situation récente as-tu choisi et agi par toi-même ?',
          'Qu’attends-tu de ceux qui t’accompagnent sur la Route ?',
        ),
        sapf('p. 2'),
      ),
    },
    {
      title: 'Le sens du service',
      content: doc(
        p(
          'Le service traverse tout le parcours routier : il commence par de petites actions de service simples pendant le noviciat et s’achève par un engagement personnel et durable au service des autres et de la société.',
        ),
        p(
          'Au terme du parcours, le routier apprend à servir non plus parce qu’on le lui propose, mais parce qu’il l’a choisi.',
        ),
        h('Ce que disent la loi et les principes scouts'),
        ul(
          'Article 3 de la loi scoute : « Le scout est fait pour servir et sauver son prochain. »',
          'Principe social : devoir envers les autres.',
        ),
        reflect('Quel service as-tu déjà rendu sans qu’on te le demande ?'),
        sapf('p. 3 et 4'),
        base('p. 2'),
      ),
    },
    {
      title: 'La vie communautaire',
      content: doc(
        p(
          'Dès le noviciat, le jeune participe régulièrement aux réunions de communauté et d’équipe et vit des temps de partage fraternels. Il y gagne un sentiment d’appartenance et une première expérience de vie communautaire adulte.',
        ),
        p(
          'La vie en petit groupe est l’un des huit éléments de la méthode scoute (« Base du scoutisme », p. 1). À la Route, elle se vit en équipe et en communauté.',
        ),
        quote(
          '« Le scout est l’ami de tous et le frère de tout autre scout. » (loi scoute, article 4)',
        ),
        reflect('Qu’apportes-tu à ton équipe ? Qu’en reçois-tu ?'),
        sapf('p. 3'),
        base('p. 1 et 2'),
      ),
    },
    {
      title: 'La Prière de la Route',
      content: doc(
        p(
          'La Prière de la Route est un texte fondamental de la branche. Elle est consultable dans la bibliothèque, rubrique « Textes fondamentaux », et citée en référence par ce module.',
        ),
        p(
          'Elle rassemble plusieurs idées rencontrées dans ce module : la pureté du cœur, la curiosité, le service vécu avec passion, la joie et la fraternité de ceux qui font route ensemble.',
        ),
        reflect(
          'Quelle phrase de la prière te parle le plus ? Pourquoi ?',
          'Que signifie pour toi « faire route ensemble » ?',
        ),
        conclude(
          'La Route est un chemin volontaire, orienté vers un but : devenir un adulte libre et responsable.',
          'Elle se vit dans le service, en équipe et en communauté.',
          'La prochaine étape : comprendre la progression (module « Comprendre sa progression à la Route »).',
        ),
        {
          type: 'paragraph',
          content: [text('Source : texte fondamental « Prière de la Route ».', true)],
        },
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    overlap('NT-DEC-B06 « Présentation de la branche Route », NT-DEC-B08, NT-DEC-B11'),
    note(
      'A_COMPLETER',
      null,
      'Charte de la Route : texte non fourni, aucune leçon créée. Une fois la Charte publiée comme texte fondamental, l’ajouter aux textes cités (nouvelle version du module) et, si souhaité, une leçon de découverte.',
    ),
    note(
      'A_VERIFIER',
      5,
      'Publier la Prière de la Route avant (ou en même temps que) ce module : la bibliothèque n’affiche un texte cité qu’une fois publié.',
    ),
  ],
};

const STAGE_DURATIONS = ul(
  'Noviciat : un mois.',
  'Apprentissage : six mois.',
  'Compagnonnage : dix mois (deux mois pour la préparation du Raid et huit mois pour la préparation de l’Entreprise).',
  'Départ routier : une année scoute.',
);

const M04: SourceModule = {
  key: 'NT-ROUTE-M04',
  slug: 'route-m04-comprendre-sa-progression',
  title: 'Comprendre sa progression à la Route',
  summary:
    'Les quatre étapes du parcours routier, leurs activités, leurs signes distinctifs et leurs cérémonies.',
  objectives: [
    'Nommer les quatre étapes et leurs activités phares.',
    'Distinguer la durée d’une étape et la durée d’une activité.',
    'Reconnaître les signes distinctifs et les cérémonies du parcours.',
    'Comprendre comment la communauté accompagne un routier arrivé en cours de parcours.',
  ],
  stageCode: 'NOVICIAT',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 3 à 5 et 8 à 10',
  lessons: [
    {
      title: 'Le système de progression',
      content: doc(
        p(
          'La progression n’est pas une formalité administrative. Elle est le fil conducteur du chemin routier : elle donne une direction, un rythme et une profondeur au chemin du routier, tout en respectant son autonomie.',
        ),
        quote(
          '« Comprendre la progression, c’est savoir : où amener les routiers, à quel rythme, avec quels repères, et avec quelles exigences. »',
        ),
        h('Quatre étapes'),
        STAGE_DURATIONS,
        h('Durées des activités selon l’âge'),
        p(
          'Le tableau synoptique du manuel précise, pour chaque activité, une durée différente selon l’âge (18, 19 ou 20 ans) :',
        ),
        ul(
          'Noviciat, cérémonie de fin d’étape : 1 mois / 1 mois / 1 mois.',
          'Apprentissage, Engagement : 3 mois / 3 mois / 1 mois.',
          'Apprentissage, Mini-Camp : 3 mois / 3 mois / 1 mois.',
          'Compagnonnage, Raid : 2 mois / 2 mois / 1 mois.',
          'Compagnonnage, Entreprise : 8 mois / 5 mois / 3 mois.',
          'Départ routier, Service : 6 mois / 3 mois / 1 mois.',
          'Départ routier, Envoi : 3 mois / 1 mois / 1 mois.',
        ),
        p(
          'Ne pas confondre : la durée d’une étape couvre plusieurs activités. Ces repères ne changent jamais ton étape d’eux-mêmes : seule une décision du responsable le fait.',
        ),
        sapf('p. 3 à 5'),
      ),
    },
    {
      title: 'Le Noviciat',
      content: doc(
        p(
          'Le noviciat est la première étape du parcours routier. Il correspond à l’entrée du jeune dans la communauté et à sa découverte progressive de l’esprit de la Route. Le jeune y cherche à comprendre ce qu’est la Route, ce qu’on attend de lui, et s’il se reconnaît dans les valeurs proposées.',
        ),
        h('Activités clés'),
        ul(
          'Participation régulière aux réunions de communauté et d’équipe.',
          'Temps de partage fraternels.',
          'Petites actions de service simples.',
          'Découverte de la Charte et des symboles de la Route.',
          'Participation à une ou deux petites entreprises.',
          'Temps d’écoute et de dialogue : poser ses questions, exprimer ses attentes.',
        ),
        p(
          'Le noviciat évite un engagement précipité ou superficiel. Le jeune y gagne un sentiment d’appartenance et la possibilité de discerner s’il souhaite poursuivre ce chemin.',
        ),
        sapf('p. 3'),
      ),
    },
    {
      title: 'L’Apprentissage',
      content: doc(
        p(
          'Pendant l’apprentissage, le routier décide de s’inscrire plus durablement dans la communauté et de s’engager plus activement dans la vie d’équipe. Il apprend à devenir responsable, à travailler avec les autres et à se former par l’action.',
        ),
        h('Activités clés'),
        ul(
          'Participation active aux projets de l’équipe et de la communauté.',
          'Responsabilités concrètes et participation à l’organisation des activités.',
          'Formation au leadership partagé et au travail en équipe.',
          'Temps de réflexion, de débat et de relecture.',
          'Activités majeures : l’Engagement routier et le Mini-Camp.',
        ),
        p(
          'L’apprentissage fait passer de la participation à l’implication : le routier commence à se percevoir comme un acteur de la communauté.',
        ),
        sapf('p. 3 et 5'),
      ),
    },
    {
      title: 'Le Compagnonnage',
      content: doc(
        p(
          'Le compagnonnage est une phase de maturité : le routier prend des responsabilités importantes, soutient les plus jeunes et contribue activement à la dynamique communautaire.',
        ),
        h('Activités clés'),
        ul(
          'Le Raid (deux mois de préparation).',
          'La conduite ou la coordination de l’Entreprise (huit mois de préparation).',
          'L’implication dans des partenariats extérieurs.',
          'Un temps fort de relecture personnelle et collective.',
        ),
        p(
          'Cette étape fait passer du faire au transmettre. Le routier y gagne une identité plus affirmée, la reconnaissance de ses pairs et la conscience qu’il peut être utile aux autres.',
        ),
        sapf('p. 3 et 4'),
      ),
    },
    {
      title: 'Le Départ routier',
      content: doc(
        p(
          'Le service constitue l’aboutissement du parcours routier : un choix personnel et durable d’engagement au service des autres et de la société.',
        ),
        h('Activités clés'),
        ul(
          'Un engagement personnel : service associatif, social, ecclésial ou citoyen, assumé librement et inscrit dans la durée.',
          'Une participation continue à la vie communautaire, avec un itinéraire plus individualisé.',
          'Des temps d’accompagnement, de relecture et de témoignage.',
        ),
        p('Le Départ routier peut se vivre soit en branche, soit dans une ONG.'),
        sapf('p. 4 et 5'),
      ),
    },
    {
      title: 'Les signes distinctifs',
      content: doc(
        p('Le manuel associe à chaque activité un attribut :'),
        ul(
          'Accueil : foulard.',
          'Fin du noviciat : flot gris.',
          'Engagement : insigne routier.',
          'Mini-Camp : étoile marron.',
          'Fin de l’apprentissage : flot marron.',
          'Raid : étoile blanche.',
          'Entreprise : label de domaine d’action.',
          'Fin du compagnonnage : flot routier.',
          'Service : étoile or.',
          'Envoi : Bible.',
        ),
        p('Un signe distinctif n’est pas une récompense : il rend visible un chemin déjà engagé.'),
        sapf('p. 4, 5 et 10'),
      ),
    },
    {
      title: 'Les cérémonies',
      content: doc(
        p(
          'Les cérémonies ne sont ni du folklore, ni des récompenses. Ce sont des actes éducatifs forts, des jalons symboliques du chemin parcouru. Là où la progression structure le chemin, la cérémonie lui donne une profondeur symbolique, une mémoire et une visibilité communautaire.',
        ),
        ul(
          'Cérémonie d’accueil : de 1 à 15 jours après l’arrivée ; entrée officielle dans la branche.',
          'Cérémonie d’engagement routier : acte volontaire, personnel et réfléchi.',
          'Cérémonie de remise de flots : à chaque fin d’étape.',
          'Cérémonie de départ (ou d’envoi) : à la fin de la quatrième étape.',
        ),
        quote(
          '« Une Route sans cérémonies claires perd son sens ; des cérémonies mal préparées banalisent la progression. »',
        ),
        sapf('p. 8 à 10'),
      ),
    },
    {
      title: 'Le rattrapage pédagogique',
      content: doc(
        p(
          'Chaque routier avance à son rythme, sans comparaison. Un jeune qui rejoint la communauté en cours de parcours n’est pas en faute : la communauté l’aide à découvrir ce qu’il n’a pas encore vécu.',
        ),
        h('Comment cela fonctionne dans la communauté'),
        ul(
          'Ta date de naissance donne une étape indicative (étape théorique).',
          'Ton étape officielle est décidée par le responsable ; aucun calcul ni aucun quiz ne la change.',
          'Si un écart existe, l’encadrement peut te proposer des modules des étapes précédentes et un accompagnement.',
          'Un rattrapage n’est considéré comme acquis que par une décision humaine.',
          'L’appartenance à la branche prend fin le jour du 21e anniversaire.',
        ),
        reflect(
          'Quelles étapes du parcours as-tu déjà vécues, dans la Route ou ailleurs ?',
          'De quoi aurais-tu besoin pour rattraper ce que tu n’as pas encore découvert ?',
        ),
        conclude(
          'Quatre étapes : Noviciat, Apprentissage, Compagnonnage, Départ routier.',
          'Chaque étape a ses activités, ses signes et sa cérémonie.',
          'Ta progression officielle est toujours décidée par une personne, jamais par un calcul.',
        ),
        sapf('p. 2 et 3'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Noviciat'),
    overlap(
      'NT-DEC-D16, NT-DEC-D17, NT-DEC-D18, NT-DEC-D19, NT-DEC-D20, NT-DEC-D21, NT-DEC-D22, NT-DEC-D24',
    ),
    note(
      'A_VERIFIER',
      0,
      'Tableau synoptique : le manuel ne dit pas si les colonnes « 18 ans / 19 ans / 20 ans » désignent l’âge d’entrée dans la branche. Formulation volontairement neutre ; aucune règle n’est appliquée par la plateforme (voir docs/REFERENTIEL_PEDAGOGIQUE.md).',
    ),
    note(
      'A_VERIFIER',
      5,
      'Le manuel (p. 5) écrit « Compagnonnage : Raid et Entreprise, Flot » sans préciser la couleur ; le tableau p. 4 indique « Flot Routier ». Signification de chaque signe non développée dans la source.',
    ),
    note(
      'A_VERIFIER',
      7,
      'Leçon fondée sur les règles de la communauté déjà validées (étape théorique / officielle, décision humaine, sortie à 21 ans) et non sur le manuel, qui ne traite pas du rattrapage. À relire par le responsable.',
    ),
  ],
};

// ─── APPRENTISSAGE ─────────────────────────────────────────────────────────

const M05: SourceModule = {
  key: 'NT-ROUTE-M05',
  slug: 'route-m05-vie-en-equipe-et-responsabilites',
  title: 'Vie en équipe et responsabilités',
  summary:
    'Passer de la participation à l’implication : trouver sa place, prendre des responsabilités et travailler avec les autres.',
  objectives: [
    'Situer sa place dans l’équipe et la communauté.',
    'Assumer une responsabilité concrète et en mesurer les conséquences.',
    'Contribuer à un projet d’équipe dans un esprit de leadership partagé.',
  ],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 2, 3, 6 et 9 ; « Base du scoutisme » p. 1',
  lessons: [
    {
      title: 'L’organisation de l’équipe',
      content: doc(
        p(
          'La vie en petit groupe est l’un des huit éléments de la méthode scoute. À la Route, le routier vit en équipe au sein de la communauté : il participe aux réunions d’équipe et de communauté, et l’équipe est présente lors de chaque cérémonie.',
        ),
        p(
          'La communauté réunit les équipes, la maîtrise routier et l’aumônier (tableau des cérémonies du manuel).',
        ),
        reflect('Comment ton équipe se répartit-elle aujourd’hui les rôles ?'),
        sapf('p. 3 et 10'),
        base('p. 1'),
      ),
    },
    {
      title: 'La place de chacun dans la communauté',
      content: doc(
        p(
          'Dès l’accueil, le jeune comprend qu’il n’est plus seulement participant, mais acteur de sa communauté.',
        ),
        p(
          'Pendant l’apprentissage, il commence à se percevoir non plus comme un simple membre, mais comme un acteur de la communauté.',
        ),
        p(
          'L’encadrement accompagne sans se substituer : il veille à la qualité de la progression collective et individuelle.',
        ),
        reflect('À quoi reconnaît-on, dans ta communauté, quelqu’un qui est « acteur » ?'),
        sapf('p. 2, 3 et 9'),
      ),
    },
    {
      title: 'La responsabilité individuelle',
      content: doc(
        p(
          'L’apprentissage est une phase où le routier apprend à devenir responsable. Il apprend à agir, à persévérer, à assumer des engagements et à mesurer les conséquences de ses choix.',
        ),
        p(
          'Il en retire une montée en confiance, des compétences concrètes et une meilleure connaissance de lui-même.',
        ),
        quote('« Le scout met son honneur à mériter confiance. » (loi scoute, article 1)'),
        reflect('Quel engagement as-tu pris récemment ? L’as-tu tenu jusqu’au bout ?'),
        sapf('p. 3'),
      ),
    },
    {
      title: 'La collaboration',
      content: doc(
        p(
          'Travailler avec les autres est au cœur de l’apprentissage. On le retrouve dans le Mini-Camp (responsabilité partagée, organisation et gestion commune) et dans l’Entreprise (travailler en équipe).',
        ),
        reflect(
          'Quelle difficulté rencontres-tu le plus souvent quand tu travailles en équipe ?',
          'Comment pourrais-tu y répondre la prochaine fois ?',
        ),
        sapf('p. 3, 5 et 6'),
      ),
    },
    {
      title: 'Le leadership partagé',
      content: doc(
        p(
          'Pendant l’apprentissage, le routier commence à se former au leadership partagé et au travail en équipe. Au compagnonnage, il pourra conduire ou coordonner l’Entreprise et soutenir les plus jeunes.',
        ),
        reflect('Dans ton équipe, qui prend l’initiative ? Comment chacun peut-il y contribuer ?'),
        sapf('p. 3 et 4'),
      ),
    },
    {
      title: 'La participation aux projets',
      content: doc(
        p(
          'Les activités clés de l’apprentissage sont centrées sur la participation active aux projets de l’équipe et de la communauté : le routier prend des responsabilités concrètes et participe à l’organisation des activités.',
        ),
        p(
          'Des temps de réflexion, de débat et de relecture sont essentiels pour donner du sens à l’action menée.',
        ),
        reflect('Quel projet de la communauté pourrais-tu prendre en charge ce trimestre ?'),
        conclude(
          'L’apprentissage fait passer de la participation à l’implication.',
          'Une responsabilité se prend, se tient et se relit.',
          'Le travail en équipe prépare au Mini-Camp et à l’Entreprise.',
        ),
        sapf('p. 3'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    overlap('NT-DEC-B10 « Fonctionnement des équipes », NT-DEC-C15'),
    note(
      'A_COMPLETER',
      0,
      'Organisation concrète des équipes de la communauté Nikola Tesla (nombre, rôles, réunions) : non décrite dans les sources.',
    ),
    note(
      'A_COMPLETER',
      4,
      'Le manuel cite le leadership partagé sans le définir : contenu de formation à compléter d’après une source vérifiée.',
    ),
  ],
};

const M06: SourceModule = {
  key: 'NT-ROUTE-M06',
  slug: 'route-m06-engagement-routier-et-ceremonies',
  title: 'Engagement routier et cérémonies',
  summary:
    'Le sens de l’Engagement routier, sa préparation, et les cérémonies qui jalonnent le parcours.',
  objectives: [
    'Expliquer pourquoi l’Engagement routier est un acte volontaire et réfléchi.',
    'Identifier les étapes de la préparation à l’engagement.',
    'Décrire les cérémonies d’accueil, d’engagement et de remise des flots.',
  ],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 3 à 5 et 8 à 10',
  lessons: [
    {
      title: 'Le sens de l’engagement routier',
      content: doc(
        p(
          'L’Engagement routier est le cœur de la vie à la Route. Il ne s’agit pas d’un passage automatique, mais d’un acte volontaire, personnel et réfléchi par lequel le routier choisit librement d’adhérer à l’idéal de la Route et de vivre selon la Charte de la branche.',
        ),
        p('Cet engagement marque une étape décisive dans la maturation du jeune.'),
        reflect('Qu’est-ce qui distingue un engagement d’une simple participation ?'),
        sapf('p. 9'),
      ),
    },
    {
      title: 'La préparation à l’engagement',
      content: doc(
        p(
          'L’engagement se prépare pendant l’apprentissage. Le tableau synoptique du manuel lui consacre une période de 3 mois (18 et 19 ans) ou d’1 mois (20 ans) ; l’attribut associé est l’insigne routier.',
        ),
        p(
          'Il s’appuie sur des échanges personnels avec le coordinateur ou l’aumônier, au cours desquels le jeune relit le chemin parcouru.',
        ),
        reflect(
          'Avec qui aimerais-tu échanger pour préparer ton engagement ?',
          'Quelles questions voudrais-tu lui poser ?',
        ),
        sapf('p. 4 et 9'),
      ),
    },
    {
      title: 'Le discernement',
      content: doc(
        p(
          'À l’issue des échanges personnels, le jeune fait la relecture du chemin parcouru et acquiert un discernement réel sur le sens de l’engagement.',
        ),
        p(
          'Ce discernement commence dès le noviciat, où le jeune discerne s’il souhaite poursuivre le chemin de la Route.',
        ),
        reflect(
          'Qu’est-ce qui te donne aujourd’hui envie de t’engager ? Qu’est-ce qui te retient ?',
        ),
        sapf('p. 3 et 9'),
      ),
    },
    {
      title: 'La cérémonie d’accueil',
      content: doc(
        p(
          'L’accueil à la communauté (montée d’un jeune venu d’une autre branche, ou entrée d’un jeune pour la première fois dans le mouvement scout) marque l’entrée officielle du jeune dans la Branche Route.',
        ),
        p(
          'La cérémonie doit être simple, sobre et signifiante, et mettre l’accent sur l’accueil et la confiance accordée. Le jeune y prend conscience de son entrée dans une communauté ; il se sent attendu et reconnu.',
        ),
        h('Repères pratiques'),
        ul(
          'Moment : de 1 à 15 jours après l’arrivée.',
          'Rassemblement : en rectangle.',
          'Acteurs : le ou les novices, les équipes, la maîtrise routier, l’aumônier.',
          'Objet : l’étendard. L’attribut associé à l’accueil est le foulard.',
        ),
        p(
          'Le jeune en retire un fort sentiment d’appartenance et une première responsabilisation : il comprend qu’il n’est plus seulement participant, mais acteur de sa communauté.',
        ),
        reflect('Comment ta communauté peut-elle faire sentir à un nouveau qu’il est attendu ?'),
        sapf('p. 4, 9 et 10'),
      ),
    },
    {
      title: 'La cérémonie d’engagement',
      content: doc(
        p(
          'La cérémonie doit être préparée avec soin, vécue dans un climat de recueillement et de solennité, et jamais banalisée.',
        ),
        p(
          'Elle permet au jeune de poser un choix clair et public : une participation plus ou moins implicite devient un engagement assumé. Le routier en retire une plus grande cohérence intérieure, un sentiment de responsabilité vis-à-vis de lui-même et de la communauté, et une motivation renouvelée.',
        ),
        sapf('p. 9'),
      ),
    },
    {
      title: 'La remise des flots',
      content: doc(
        p(
          'La remise des flots est un signe visible de l’appartenance du routier à la communauté et de sa progression dans la Route. Elle reconnaît un chemin déjà engagé et rappelle l’idéal de service auquel le routier a choisi d’adhérer.',
        ),
        p(
          'Elle doit toujours être accompagnée d’une explication claire de la signification symbolique des flots.',
        ),
        h('Repères pratiques'),
        ul(
          'Moment : à chaque fin d’étape.',
          'Rassemblement : en rectangle.',
          'Acteurs : le ou les routiers en fin d’étape, les équipes, la maîtrise routier, l’aumônier.',
          'Objets : les flots, l’étendard.',
        ),
        sapf('p. 10'),
      ),
    },
    {
      title: 'Les symboles de progression',
      content: doc(
        p(
          'Les flots marquent la fin des étapes : flot gris (noviciat), flot marron (apprentissage), flot routier (compagnonnage). D’autres signes jalonnent les activités : insigne routier (engagement), étoiles marron, blanche et or (Mini-Camp, Raid, Service).',
        ),
        p(
          'Ces signes valorisent le chemin parcouru sans en faire un aboutissement : ils encouragent le routier à poursuivre son engagement.',
        ),
        reflect('Quel sens donnes-tu au flot ou à l’insigne que tu portes ou que tu recevras ?'),
        conclude(
          'L’engagement est un choix libre, préparé et relu.',
          'La cérémonie le rend public ; elle ne doit jamais être banalisée.',
          'Les signes de progression se reçoivent avec l’explication de leur sens.',
        ),
        sapf('p. 4, 5 et 10'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    overlap('NT-DEC-D20 « Présentation des flots », NT-DEC-D21'),
    note(
      'A_COMPLETER',
      4,
      'Déroulement, formule d’engagement et rôle de chacun pendant la cérémonie : non décrits dans le manuel (dépendent de la Charte et des usages de la communauté).',
    ),
    note(
      'A_COMPLETER',
      6,
      'Signification symbolique de chaque flot et de chaque étoile : non développée dans le manuel, à rédiger d’après une source vérifiée.',
    ),
  ],
};

const M07: SourceModule = {
  key: 'NT-ROUTE-M07',
  slug: 'route-m07-mini-camp-et-vie-communautaire',
  title: 'Mini-Camp et vie communautaire',
  summary:
    'Préparer et vivre le Mini-Camp : un temps de vie communautaire prolongée organisé par les routiers eux-mêmes.',
  objectives: [
    'Expliquer les objectifs éducatifs du Mini-Camp.',
    'Participer à sa préparation : intendance, animation, rôles, budget.',
    'Relire l’expérience vécue.',
  ],
  stageCode: 'APPRENTISSAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 3 à 6',
  lessons: [
    {
      title: 'Présentation du Mini-Camp',
      content: doc(
        p(
          'Le Mini-Camp est un temps de vie communautaire prolongée, généralement sur quelques jours, qui permet aux routiers de vivre intensément la fraternité, la coresponsabilité et la simplicité.',
        ),
        p(
          'C’est l’une des deux activités majeures de l’apprentissage, avec l’Engagement routier. Le tableau synoptique lui consacre 3 mois (18 et 19 ans) ou 1 mois (20 ans) ; l’attribut associé est l’étoile marron.',
        ),
        sapf('p. 4 et 5'),
      ),
    },
    {
      title: 'Objectifs éducatifs',
      content: doc(
        p('Le Mini-Camp développe :'),
        ul(
          'le sens de la vie collective ;',
          'la responsabilité partagée ;',
          'l’organisation et la gestion commune ;',
          'la fraternité et la solidarité ;',
          'la capacité à vivre simplement.',
        ),
        p('Il favorise également les échanges profonds, la formation et les temps spirituels.'),
        sapf('p. 5'),
      ),
    },
    {
      title: 'Préparation collective',
      content: doc(
        p(
          'Le Mini-Camp est préparé et organisé par les routiers eux-mêmes. Le coordinateur accompagne la préparation et garantit la participation active de tous.',
        ),
        h('Application pratique'),
        p('Une préparation en équipe peut suivre ces étapes :'),
        ol(
          'fixer ensemble les dates, le lieu et les objectifs du Mini-Camp, avec le coordinateur ;',
          'répartir l’intendance, l’animation, les rôles et le budget ;',
          'bâtir un programme qui équilibre action, formation et temps spirituels ;',
          'faire un point avant le départ : chacun sait ce qu’il porte et à qui il rend compte.',
        ),
        p('Personne n’est spectateur : chaque routier a une part de la préparation.'),
        reflect('Quelles décisions faut-il prendre ensemble avant de partir ?'),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Organisation des responsabilités',
      content: doc(
        p('Les routiers se répartissent l’ensemble de l’organisation :'),
        ul('l’intendance ;', 'l’animation ;', 'la répartition des rôles ;', 'le budget.'),
        p('Le coordinateur veille à l’équilibre entre action, formation et temps spirituels.'),
        h('Exemple de répartition (à adapter)'),
        ul(
          'Intendance : menus, achats, cuisine, rangement du matériel.',
          'Animation : veillées, jeux, temps de formation.',
          'Budget : prévisions, dépenses, reçus, bilan financier présenté à l’équipe.',
          'Temps spirituels : préparation des prières et des temps de relecture, avec l’aumônier.',
        ),
        p(
          'Chaque responsable rend compte à l’équipe : la responsabilité partagée n’est pas une responsabilité diluée.',
        ),
        reflect('Quel rôle prendrais-tu ? Pourquoi ?'),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Intendance et sécurité',
      content: doc(
        p(
          'L’intendance et le budget font partie de ce que les routiers organisent eux-mêmes. Le Mini-Camp se vit dans la simplicité des moyens.',
        ),
        p(
          'Les règles de sécurité applicables sont celles de la communauté et du mouvement : elles sont présentées par l’encadrement avant le départ.',
        ),
        sapf('p. 5 et 6'),
      ),
    },
    {
      title: 'Vie communautaire',
      content: doc(
        p(
          'Au Mini-Camp, la fraternité, la coresponsabilité et la simplicité se vivent intensément, sur plusieurs jours. C’est un temps privilégié d’échanges profonds, de formation et de temps spirituels.',
        ),
        quote(
          '« Le scout est maître de soi, il sourit et chante dans les difficultés. » (loi scoute, article 8)',
        ),
        sapf('p. 5'),
        base('p. 2'),
      ),
    },
    {
      title: 'Relecture et bilan',
      content: doc(
        p(
          'Pendant l’apprentissage, les temps de réflexion, de débat et de relecture sont essentiels pour donner du sens à l’action menée. Le Mini-Camp se conclut donc par une relecture collective et personnelle.',
        ),
        reflect(
          'Qu’as-tu appris sur toi pendant le Mini-Camp ?',
          'Qu’est-ce que l’équipe ferait autrement la prochaine fois ?',
        ),
        conclude(
          'Le Mini-Camp est organisé par les routiers, accompagnés par le coordinateur.',
          'Il équilibre action, formation et temps spirituels.',
          'Il se termine par une relecture.',
        ),
        sapf('p. 3'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Apprentissage'),
    note(
      'A_COMPLETER',
      4,
      'Règles de sécurité, d’hygiène et d’intendance : absentes du manuel. Ne pas les inventer ; les rédiger d’après les règles du mouvement et de la communauté.',
    ),
    note(
      'A_VERIFIER',
      6,
      'La relecture du Mini-Camp n’est pas décrite explicitement par le manuel ; la leçon l’appuie sur l’exigence générale de relecture de l’apprentissage (p. 3).',
    ),
  ],
};

// ─── COMPAGNONNAGE ─────────────────────────────────────────────────────────

const M08: SourceModule = {
  key: 'NT-ROUTE-M08',
  slug: 'route-m08-le-raid-routier',
  title: 'Le Raid routier',
  summary:
    'Une activité itinérante exigeante, vécue seul ou en petite équipe : préparation, effort, autonomie et relecture.',
  objectives: [
    'Expliquer la substance éducative du Raid.',
    'Préparer un itinéraire réaliste avec des règles de sécurité claires.',
    'Relire l’expérience vécue.',
  ],
  stageCode: 'COMPAGNONNAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 3 à 5',
  lessons: [
    {
      title: 'Qu’est-ce qu’un Raid ?',
      content: doc(
        p(
          'Le Raid est une activité itinérante, vécue individuellement ou en petite équipe, qui met le routier en situation d’effort, de sobriété et d’autonomie.',
        ),
        p(
          'C’est un temps volontairement exigeant, marqué par la marche, la simplicité des moyens et le contact direct avec la nature et les populations rencontrées.',
        ),
        p(
          'Activité phare du compagnonnage, il bénéficie de deux mois de préparation ; l’attribut associé est l’étoile blanche.',
        ),
        sapf('p. 3 à 5'),
      ),
    },
    {
      title: 'Objectifs éducatifs',
      content: doc(
        p('Le Raid permet au routier de :'),
        ul(
          'développer l’endurance physique et mentale ;',
          'apprendre à gérer l’effort et la fatigue ;',
          'renforcer l’autonomie et la responsabilité personnelle ;',
          'vivre la solidarité et l’entraide ;',
          'prendre du recul par la relecture personnelle et spirituelle.',
        ),
        sapf('p. 5'),
      ),
    },
    {
      title: 'Préparation',
      content: doc(
        p(
          'Le Raid doit être soigneusement préparé : itinéraire réaliste, règles de sécurité claires, objectifs éducatifs définis et temps de relecture prévus à l’issue.',
        ),
        h('Liste de préparation'),
        ul(
          'Itinéraire : étapes et distances adaptées à chacun, points d’arrivée connus.',
          'Sécurité : règles présentées et validées par l’encadrement avant le départ.',
          'Objectifs : ce que chacun et l’équipe veulent vivre et apprendre.',
          'Relecture : moment et forme prévus dès la préparation.',
        ),
        p(
          'Le coordinateur veille à ce que le Raid reste une expérience de croissance, et non un défi sportif ou une mise en danger.',
        ),
        reflect('Quels objectifs personnels te fixes-tu pour ce Raid ?'),
        sapf('p. 5'),
      ),
    },
    {
      title: 'Itinéraire et organisation',
      content: doc(
        p(
          'L’itinéraire doit être réaliste. Le Raid se vit à pied, avec des moyens simples, au contact de la nature et des populations rencontrées, individuellement ou en petite équipe.',
        ),
        quote(
          '« Le scout voit dans la nature l’œuvre de Dieu, il aime les plantes et les animaux. » (loi scoute, article 6)',
        ),
        sapf('p. 5'),
        base('p. 2'),
      ),
    },
    {
      title: 'Endurance et autonomie',
      content: doc(
        p(
          'Le Raid met le routier en situation d’effort, de sobriété et d’autonomie. Il apprend à gérer l’effort et la fatigue, et à compter sur lui-même comme sur ses compagnons.',
        ),
        reflect('Comment réagis-tu quand la fatigue arrive ? Qu’est-ce qui t’aide à continuer ?'),
        sapf('p. 5'),
      ),
    },
    {
      title: 'Règles de sécurité',
      content: doc(
        p(
          'Des règles de sécurité claires font partie de la préparation. Le coordinateur veille à ce que le Raid reste une expérience de croissance, et non un défi sportif ou une mise en danger.',
        ),
        p('Les règles applicables sont présentées et validées par l’encadrement avant le départ.'),
        sapf('p. 5'),
      ),
    },
    {
      title: 'Relecture du Raid',
      content: doc(
        p(
          'Des temps de relecture sont prévus à l’issue du Raid. Ils permettent de prendre du recul, sur le plan personnel et spirituel, sur l’expérience vécue.',
        ),
        reflect(
          'Quel moment du Raid t’a le plus marqué ?',
          'Qu’as-tu découvert sur ta façon de vivre l’effort et l’entraide ?',
        ),
        conclude(
          'Le Raid est exigeant mais jamais dangereux : c’est une expérience de croissance.',
          'Il se prépare (itinéraire, sécurité, objectifs) et se relit.',
        ),
        sapf('p. 5'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Compagnonnage'),
    note(
      'A_COMPLETER',
      5,
      'Contenu des règles de sécurité (encadrement, autorisations, distances, matériel, conduite à tenir) : absent du manuel. À rédiger d’après les règles du mouvement ; ne pas inventer.',
    ),
  ],
};

// ─── Entreprise routière : sources complémentaires (mission du 2026-11-02) ──

const GUIDE_DOCUMENT = 'Entreprise_Route_Nikola_Tesla_Edition_Officielle.pdf';
const GUIDE_SHA256 = '46c8bdbcba843d3e0b9dede4186a5cd109af269004489f50a17e9aed28bebff2';
const FICHE7_SHA256 = 'c583b2dc61026d835a433ed560a723299245d1d8f66417057bde6082d4e9c0a0';
const OSSATURE_SHA256 = '870894213f85e0386a6e13227c69a20d1afd101ce36a380d77c85396dd347f67';
const TDR_SHA256 = '569ab14bbd21126e82a7fa56b2778356acda34764c6cb6213bc7d971fc475771';

/** Guide de l'Entreprise de la communauté (pages du PDF, sans numérotation imprimée). */
const guide = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [
    text(
      `Source : « Guide pédagogique — L’Entreprise à la Route », Nikola Tesla 2026–2027, ${pages}.`,
      true,
    ),
  ],
});
/** Fiche technique n° 7 « Méthodologie Entreprise » : ancien support, repères historiques. */
const fiche7 = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [
    text(
      `Source : fiche technique n° 7 « Méthodologie Entreprise » (ancien support), ${pages}.`,
      true,
    ),
  ],
});
const ossature = (): LessonBlock => ({
  type: 'paragraph',
  content: [text('Source : « Ossature de rédaction de l’Entreprise Route ».', true)],
});
const tdr = (pages: string): LessonBlock => ({
  type: 'paragraph',
  content: [
    text(
      `Source : termes de référence du CAFDR, communauté Martin Luther King (exemple externe), ${pages}.`,
      true,
    ),
  ],
});
/** Exemple construit pour la compréhension, jamais un projet réalisé. */
const example = (...content: LessonBlock[]): LessonBlock[] => [
  h('Exemple (illustratif)'),
  ...content,
];

const M09: SourceModule = {
  key: 'NT-ROUTE-M09',
  slug: 'route-m09-l-entreprise-routiere',
  title: 'L’Entreprise routière',
  summary:
    'Guide pratique de l’Entreprise, cœur de la pédagogie de la Route : comprendre, choisir, préparer, rédiger le dossier, budgéter, réaliser, évaluer et transmettre.',
  objectives: [
    'Expliquer ce qu’est l’Entreprise, ses sept dimensions éducatives et le rôle de chacun.',
    'Choisir une Entreprise à partir d’un besoin réel, avec les bénéficiaires, par une décision collective consignée.',
    'Préparer l’Entreprise et rédiger un dossier complet : objectifs mesurables, organisation, calendrier, budget et financement.',
    'Conduire la réalisation, puis évaluer, relire et transmettre l’expérience.',
  ],
  stageCode: 'COMPAGNONNAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages:
    'SAPF-Route p. 3 à 6 ; Guide de l’Entreprise Nikola Tesla p. 1 à 9 ; fiche technique n° 7 p. 2 à 6 ; Ossature de rédaction ; TDR du CAFDR (exemple externe)',
  lessons: [
    // ─── A. Comprendre ────────────────────────────────────────────────────
    {
      title: 'Comprendre l’Entreprise',
      content: doc(
        p(
          '« Pas de Route sans Entreprise » : cette devise ouvre la fiche technique n° 7 comme le Guide de l’Entreprise de la communauté. Elle rappelle que l’Entreprise est la grande base pratique de l’éducation à la Route.',
        ),
        h('Définition'),
        p(
          'Le manuel SAPF-Route la définit comme un projet collectif structuré, conçu et réalisé par les routiers pour répondre à un besoin réel de la société. Elle constitue l’outil principal de formation par l’action à la Route.',
        ),
        p(
          'La fiche technique n° 7 reprend la définition du Père Forestier (« Scoutisme, route de la liberté ») :',
        ),
        quote(
          '« Un service collectif assumé par la communauté ou l’équipe, faisant appel à la générosité des Routiers, présentant des difficultés et de l’intérêt, susceptible de développer des compétences, et introduisant à la compréhension des problèmes apostoliques ou sociaux. »',
        ),
        p(
          'Le Guide de la communauté la résume ainsi : un service collectif pensé, préparé, réalisé et évalué par les routiers en réponse à un besoin réel.',
        ),
        h('Ce que vise l’Entreprise'),
        p(
          'Selon la fiche n° 7, l’Entreprise place les routiers dans des conditions qui leur permettent de :',
        ),
        ul(
          'développer leurs potentialités humaines et spirituelles ;',
          'acquérir des compétences ;',
          'se confronter au réel et découvrir des réalités nouvelles ;',
          'approfondir le sens qu’ils veulent donner à leur vie ;',
          'agir dans la société.',
        ),
        h('Une école de service, pas une collecte de fonds'),
        p(
          'Une Entreprise réussie ne se mesure pas seulement à sa taille ou à l’argent mobilisé : elle répond à un besoin authentique, fait grandir les routiers en responsabilité et laisse un résultat utile et vérifiable. Le Guide la décrit d’abord comme une école de service, de discernement et de vie en équipe. La recherche de fonds n’est qu’un moyen au service du projet.',
        ),
        h('Place dans le parcours'),
        p(
          'L’Entreprise est l’activité phare du compagnonnage. Le texte du manuel consacre à cette étape dix mois : deux pour la préparation du Raid et huit pour la préparation de l’Entreprise. Le tableau synoptique indique 8, 5 ou 3 mois selon les colonnes « 18 ans », « 19 ans » et « 20 ans », dont le sens reste à confirmer par le responsable ; la plateforme n’en tire aucune règle.',
        ),
        p(
          'La fiche n° 7, plus ancienne, situait l’Entreprise en deuxième année, avec une recherche de fonds possible dès la première, et la décrivait comme un projet d’envergure mené pendant les grandes vacances, conclu si possible par le Brevet Scouts du Monde. Ce sont des repères historiques, pas des obligations actuelles.',
        ),
        reflect(
          'Avec tes mots, quelle différence fais-tu entre une Entreprise et une simple activité de collecte de fonds ?',
          'Quelle expérience de service as-tu déjà vécue qui ressemblait à une Entreprise ?',
        ),
        sapf('p. 3, 4 et 6'),
        fiche7('p. 2'),
        guide('p. 1, 2 et 9'),
      ),
    },
    {
      title: 'Dimensions éducatives et responsabilités',
      content: doc(
        p(
          'L’Entreprise appartient aux routiers : ce sont eux qui la choisissent, la préparent, la conduisent et en rendent compte. Le coordinateur accompagne. Cette répartition fait de l’Entreprise une expérience de responsabilité collective.',
        ),
        h('Les sept dimensions éducatives'),
        p(
          'Le Guide de la communauté demande de vérifier que chaque Entreprise fait vivre ces sept dimensions, déjà présentées par la fiche n° 7 comme les sept points que doit contenir toute Entreprise :',
        ),
        ol(
          'Vie en équipe et coresponsabilité.',
          'Ouverture au monde et écoute des populations.',
          'Découverte de soi et progression personnelle.',
          'Action concrète au sein de la société.',
          'Esprit de service et engagement.',
          'Respect de la nature et des ressources.',
          'Collaboration avec des partenaires adaptés.',
        ),
        h('L’esprit de service'),
        p(
          'L’Entreprise fait appel à la générosité des routiers : on agit pour un besoin qui n’est pas le sien, avec les personnes concernées et non seulement pour elles. Le manuel y voit l’occasion de s’engager concrètement au service des autres.',
        ),
        h('Les responsabilités des routiers'),
        p(
          'Le Guide propose des fonctions de projet, qui ne sont pas des grades : coordination opérationnelle, secrétariat et compte rendu, trésorerie, logistique, partenariats, sécurité, suivi et évaluation. Chaque fonction produit un livrable : plan d’action actualisé, budget et justificatifs, contacts et accords écrits, inventaire du matériel, indicateurs et rapport final.',
        ),
        h('Le rôle du coordinateur'),
        p(
          'Le coordinateur de communauté accompagne sans diriger. Il questionne la pertinence du projet, veille à sa cohérence avec l’esprit de la Route et garantit la qualité éducative, sans se substituer aux porteurs du projet.',
        ),
        ul(
          'Il pose des questions plutôt que de donner les réponses.',
          'Il rappelle le cap lorsque l’essentiel se dilue.',
          'Il veille à la sécurité et au respect du cadre de l’association.',
          'Il ne prend pas les décisions de l’équipe à sa place.',
        ),
        reflect(
          'Parmi les sept dimensions, laquelle te semble la plus difficile à faire vivre, et pourquoi ?',
          'Quelle fonction de projet correspond le mieux à tes compétences actuelles ? Laquelle aimerais-tu apprendre ?',
        ),
        sapf('p. 2 et 6'),
        fiche7('p. 2'),
        guide('p. 2 et 6'),
      ),
    },
    // ─── B. Choisir ───────────────────────────────────────────────────────
    {
      title: 'Observer un besoin réel',
      content: doc(
        p(
          'Toute Entreprise commence par l’analyse du besoin. Le manuel en fait la première compétence travaillée : apprendre à analyser une situation et à identifier un besoin réel de la société. Le Guide en fait la première phase : un diagnostic réalisé avec les bénéficiaires.',
        ),
        h('Observer'),
        p(
          'Les idées naissent des enquêtes, des sorties, des réunions et des contacts des routiers. Il s’agit de regarder autour de soi avec attention : quartier, paroisse, école, village, structure d’accueil.',
        ),
        h('Consulter les bénéficiaires'),
        p('Le Guide propose de répondre à ces questions avant de retenir une idée :'),
        ul(
          'Quel problème concret a été observé, et par qui ?',
          'Qui subit le problème, à quelle fréquence et avec quelles conséquences ?',
          'Quelles solutions existent déjà, et pourquoi sont-elles insuffisantes ?',
          'Comment les bénéficiaires participent-ils à la définition de la réponse ?',
          'Quelles données, visites ou témoignages permettent de confirmer le besoin ?',
        ),
        h('Impression ou diagnostic ?'),
        p(
          'Le Guide met en garde contre une confusion fréquente : une impression personnelle n’est pas un diagnostic. « Les enfants de ce quartier manquent de livres » reste une impression tant que l’équipe n’a pas rencontré les familles, l’école ou la bibliothèque, ni vérifié ce qui existe déjà.',
        ),
        h('Application pratique'),
        ol(
          'Noter les constats de chacun, sans juger les idées.',
          'Rencontrer les personnes concernées et les acteurs locaux (responsables de la structure, autorités, associations présentes).',
          'Vérifier les solutions déjà en place pour ne pas faire double emploi.',
          'Rédiger un court état des lieux : c’est la preuve attendue à la fin du diagnostic.',
        ),
        ...example(
          p(
            'Des routiers apprennent qu’une école voisine manque de points d’eau en état de marche. Avant de proposer quoi que ce soit, ils rencontrent la direction, des parents et des élèves : le problème est-il réel, depuis quand, qui est touché, une réparation est-elle déjà prévue ? Leur état des lieux mentionne le nombre de points d’eau hors service et ce qu’en disent les personnes rencontrées.',
          ),
        ),
        reflect(
          'Cite un besoin que tu crois avoir repéré autour de toi. Quelles personnes devrais-tu rencontrer pour vérifier qu’il est réel ?',
        ),
        sapf('p. 6'),
        fiche7('p. 3'),
        guide('p. 2, 4 et 5'),
      ),
    },
    {
      title: 'Choisir l’Entreprise ensemble',
      content: doc(
        p(
          'Le choix de l’Entreprise est une décision collective. La fiche n° 7 décrit une démarche que le Guide complète par une grille de sélection et un procès-verbal.',
        ),
        h('Les étapes du choix'),
        ol(
          'Rechercher plusieurs idées : chaque routier ou chaque équipe présente des projets, fruits de ses enquêtes et de ses contacts.',
          'Présenter les propositions à la communauté, avec le besoin observé et les premières informations recueillies.',
          'Comparer les avantages et les difficultés de chaque projet, son urgence et son utilité.',
          'Noter les projets avec la grille de sélection.',
          'Délibérer : chacun exprime son avis et l’écoute de tous est garantie.',
          'Voter : la communauté choisit un projet, et tous les routiers s’engagent à le réaliser.',
          'Consigner la décision dans un procès-verbal.',
        ),
        h('La grille de sélection'),
        p('Le Guide propose six critères, chacun noté sur cinq points, soit un total sur trente :'),
        ul(
          'besoin réel établi ;',
          'participation des bénéficiaires ;',
          'impact social ou éducatif ;',
          'faisabilité et sécurité ;',
          'mobilisation possible de l’équipe ;',
          'durabilité de l’action.',
        ),
        p(
          'La grille aide à comparer ; elle ne décide pas à la place de la communauté. Deux projets proches au total se départagent par la délibération, en regardant les critères où ils diffèrent.',
        ),
        h('Le procès-verbal de décision'),
        p(
          'Le Guide demande de conserver le compte rendu de décision. Il est conseillé d’y faire figurer : la date et le lieu, le nombre de présents, les projets comparés avec leur total, les principaux arguments, le résultat du vote, le projet retenu et son domaine principal, les engagements pris et les prochaines étapes. Le secrétaire (rapporteur) le rédige et le signe avec la coordination.',
        ),
        h('Choisir le domaine d’action'),
        p(
          'Un projet peut relever de plusieurs domaines, mais il convient d’en choisir un principal et de justifier les autres. Le domaine découle du besoin observé, pas l’inverse : on ne choisit pas un domaine pour ensuite chercher un problème. Le module « Domaines d’action de l’Entreprise » présente les dix domaines.',
        ),
        reflect(
          'Pourquoi un vote sans comparaison préalable des projets risque-t-il de produire un mauvais choix ?',
          'Quel critère de la grille te paraît le plus souvent négligé ?',
        ),
        fiche7('p. 3'),
        guide('p. 2, 8 et 9 (annexe A)'),
      ),
    },
    // ─── C. Préparer ──────────────────────────────────────────────────────
    {
      title: 'Préparer : objectifs, faisabilité et équipes',
      content: doc(
        p(
          'Selon la fiche n° 7, la préparation se fait en conseil d’équipe : on « démonte » l’Entreprise, c’est-à-dire qu’on cherche tout ce qui doit être mis en œuvre pour la réaliser (contacts, matériaux, responsabilités, compétences, travaux), puis on entre en contact avec les autorités.',
        ),
        h('Formuler des objectifs'),
        p(
          'Le Guide demande un objectif général, qui décrit le changement souhaité, puis des objectifs spécifiques mesurables, réalistes et datés. Il distingue les actions (ce que l’on fait), les résultats (ce qui est produit) et les effets (ce qui change pour les bénéficiaires).',
        ),
        p(
          'Un objectif est mesurable lorsqu’on peut vérifier, à une date donnée, s’il est atteint : un nombre, un état observable, une échéance. « Aider l’école » n’est pas mesurable ; « remettre en état trois points d’eau identifiés avant la fin de l’intervention » l’est.',
        ),
        ...example(
          p('Formulations proposées par le Guide :'),
          ul(
            'Objectif général : contribuer à de meilleures conditions d’apprentissage dans une école partenaire.',
            'Objectif spécifique : remettre en état trois points d’eau identifiés avant la fin de l’intervention.',
            'Activité : diagnostiquer les installations, acquérir les pièces, organiser les travaux.',
            'Indicateur : nombre de points d’eau fonctionnels lors de la réception.',
          ),
        ),
        h('Analyser la faisabilité'),
        p(
          'Le Guide demande d’expliquer les difficultés possibles : insuffisance de fonds, disponibilité des routiers, météo, autorisations, sécurité et maintenance. Pour chacune, on précise la mesure préventive et la personne qui en est responsable. Un projet séduisant mais irréalisable avec les moyens de la communauté doit être redimensionné.',
        ),
        h('Constituer les équipes'),
        p(
          'Chaque fonction de projet est confiée à un routier ou à une équipe qui l’accepte : coordination, trésorerie, partenariats, logistique, sécurité, suivi et bilan, secrétariat. Une répartition écrite évite les oublis et les doublons ; chacun sait ce qu’il doit produire et à quelle échéance.',
        ),
        h('Partenaires et autorisations'),
        p(
          'Le dossier précise les personnes ou structures consultées, leurs engagements confirmés, les autorisations à obtenir et les modalités de coordination. Les accords sont obtenus par écrit et conservés. Le logo d’un partenaire n’apparaît qu’avec son accord.',
        ),
        reflect(
          'Transforme « sensibiliser les jeunes à l’hygiène » en un objectif spécifique mesurable et daté.',
          'Quelle difficulté de faisabilité ton équipe sous-estime-t-elle le plus souvent ?',
        ),
        fiche7('p. 3'),
        guide('p. 4, 5 et 6'),
      ),
    },
    {
      title: 'Préparer : ressources, sécurité et calendrier',
      content: doc(
        p(
          'Une fois les objectifs et les équipes fixés, la préparation recense les ressources, anticipe les risques et organise le temps.',
        ),
        h('Ressources humaines'),
        p(
          'L’ossature demande de présenter les personnes avec qui l’on va réaliser le projet, leur nombre et leurs capacités. Le Guide ajoute : faire l’inventaire des compétences disponibles, puis identifier ce qui manque (savoir-faire technique, encadrement, accompagnement extérieur).',
        ),
        h('Ressources matérielles'),
        p(
          'On fait l’inventaire du matériel à disposition, puis de ce qu’il faut acheter, emprunter ou recevoir. Le Guide demande de distinguer les contributions en nature (prêt de matériel, transport, temps de bénévolat) des apports financiers.',
        ),
        h('Risques et sécurité'),
        p(
          'Le Guide demande un plan de prévention et la prise en compte de la protection des participants. Les interventions techniques (électricité, santé, construction) nécessitent des professionnels qualifiés et les autorisations appropriées. Les règles de sécurité de l’association et de la communauté s’appliquent en priorité ; l’encadrement les précise.',
        ),
        p('Méthode proposée pour chaque risque identifié :'),
        ul(
          'décrire la situation à risque (lieu, activité, public) ;',
          'prévoir la mesure qui l’évite ou la réduit ;',
          'désigner la personne responsable de cette mesure ;',
          'savoir qui prévenir et quoi faire si l’incident se produit.',
        ),
        h('Le calendrier'),
        p(
          'Le Guide demande de distinguer cinq temps : diagnostic, préparation, mobilisation des ressources, intervention et évaluation, avec des dates réalistes qui tiennent compte du calendrier scout et de la disponibilité des bénéficiaires. Le chronogramme indique pour chaque étape la période, le responsable et la preuve attendue (état des lieux, compte rendu, devis et reçus, fiche d’exécution, bilan signé). L’ossature ajoute un programme d’activités précis, avec les dates et si possible les heures.',
        ),
        h('Application pratique'),
        p('Avant de lancer la réalisation, l’équipe vérifie la checklist du Guide :'),
        ul(
          'le besoin est confirmé par les bénéficiaires ;',
          'les rôles et tâches sont acceptés ;',
          'le dossier et le calendrier sont validés ;',
          'les autorisations sont réunies ;',
          'le budget est réaliste et les dépenses traçables ;',
          'les risques et la protection des participants sont pris en compte ;',
          'les modalités de suivi, de réception et d’entretien sont définies.',
        ),
        reflect(
          'Pour une activité avec des enfants, quels risques faut-il prévoir, et qui en serait responsable ?',
        ),
        ossature(),
        guide('p. 4, 5, 6 et 9 (annexe C)'),
      ),
    },
    // ─── D. Rédiger le dossier ────────────────────────────────────────────
    {
      title: 'Rédiger le dossier : de la page de garde aux bénéficiaires',
      content: doc(
        p(
          'Le dossier de l’Entreprise est un document explicatif qui présente l’équipe, le déroulement et les actions du projet, ses partenaires et son budget. Il sert à convaincre et à informer les responsables, les bénéficiaires et les partenaires. Le Guide précise ce qu’il faut écrire dans chaque partie ; les informations propres au projet sont renseignées par l’équipe.',
        ),
        h('1. Page de garde'),
        p(
          'Elle identifie immédiatement le porteur et l’objet du projet : logo de la communauté, identifiants associatifs officiels selon les supports autorisés, titre, domaine d’action, lieu, période et partenaires confirmés. L’ancien modèle demandait le logo de l’ASCCI, celui de la branche Route, le titre et les logos des partenaires.',
        ),
        h('2. Fiche résumé'),
        p(
          'Placée juste après la couverture (deuxième page), elle tient sur une page et présente l’essentiel : titre, porteurs, problème constaté, objectif global, bénéficiaires, site et calendrier, partenaires, budget (total, ressources acquises, financement restant) et deux à quatre résultats vérifiables. On la rédige en dernier, quand le reste du dossier est stable.',
        ),
        h('3. Introduction'),
        p(
          'Elle présente le contexte général, la situation locale observée et le domaine d’action retenu, puis explique brièvement pourquoi l’intervention est utile, pertinente et compatible avec les moyens de la communauté. Elle part d’un constat et amène l’intérêt du projet (son bien-fondé).',
        ),
        h('4. Présentation du scoutisme et des porteurs'),
        p(
          'D’abord, une présentation succincte et vérifiée du scoutisme, de l’Association des Scouts Catholiques de Côte d’Ivoire, de la branche Route et de la place de l’Entreprise. Ensuite, les porteurs : la communauté Nikola Tesla, les équipes mobilisées, leurs compétences et les responsabilités acceptées. Le coordinateur est mentionné comme accompagnateur pédagogique.',
        ),
        h('5. Cadre du projet'),
        ul(
          'Titre et domaine : un intitulé simple et clair, qui suffit à comprendre l’idée ; le domaine principal et, le cas échéant, les domaines complémentaires.',
          'Site : le lieu exact, pourquoi il a été choisi, ses conditions d’accès, les acteurs locaux, les conditions favorables et défavorables (l’ossature cite la présence d’une rivière, favorable au jardinage). Une carte ou des photographies légendées seulement avec les autorisations nécessaires.',
          'Période : les dates du diagnostic, de la préparation, de la mobilisation des ressources, de l’intervention et de l’évaluation.',
          'Partenaires et autorisations : structures consultées, engagements confirmés, autorisations à obtenir.',
        ),
        h('6. Justification'),
        p(
          'C’est le constat qui motive le projet. Il répond aux questions du diagnostic : quel problème se pose, quelle population est concernée, quelles sont les conséquences actuelles, en quoi le projet est une solution, comment la population a participé au choix. Il s’appuie sur des données, des visites ou des témoignages.',
        ),
        h('7. Objectifs'),
        p(
          'Le but (objectif général) et les objectifs spécifiques mesurables, réalistes et datés, avec leurs indicateurs, comme vu dans la leçon « Préparer : objectifs, faisabilité et équipes ».',
        ),
        h('8. Bénéficiaires'),
        p(
          'Ceux qui tireront profit du projet : catégories (enfants, jeunes, personnes âgées, femmes, hommes), nombre estimé, besoins exprimés et critères de choix. Le Guide distingue les bénéficiaires directs (qui reçoivent l’action) et indirects (qui en profitent par ricochet), et précise leur rôle dans la mise en œuvre : ils sont associés aux décisions et au bilan.',
        ),
        reflect(
          'Pourquoi la fiche résumé se rédige-t-elle de préférence à la fin, alors qu’elle est placée au début ?',
        ),
        fiche7('p. 3 à 5'),
        ossature(),
        guide('p. 3, 4 et 5'),
      ),
    },
    {
      title: 'Rédiger le dossier : de l’organisation à la conclusion',
      content: doc(
        p(
          'La seconde partie du dossier montre que l’équipe sait comment elle va agir, avec quels moyens, à quel coût et comment elle rendra compte.',
        ),
        h('9. Organisation'),
        p(
          'Elle présente les responsables du projet et leurs fonctions, puis les activités dans leur ordre logique. Pour chaque activité : le public concerné, la durée, le responsable, les ressources nécessaires et le résultat attendu.',
        ),
        h('10. Ressources'),
        p(
          'Les ressources humaines (personnes mobilisées, nombre, compétences) et matérielles (inventaire de ce qui est disponible, liste de ce qui manque). Les contributions en nature sont distinguées des apports financiers.',
        ),
        h('11. Chronogramme'),
        p(
          'Le tableau des étapes avec période, responsable et preuve attendue, complété par le programme détaillé des activités (dates et, si possible, heures).',
        ),
        h('12. Étude financière'),
        p(
          'Le budget précis et honnête du projet, en francs CFA, organisé par postes, avec quantités, prix unitaires et devis (voir la leçon « Budget et financement »).',
        ),
        h('13. Financement'),
        p(
          'La stratégie de mobilisation des ressources : démarches de collecte, partenaires ciblés, dossier transmis, contreparties éventuelles compatibles avec les valeurs scoutes, suivi des engagements. Aucun financement incertain n’est comptabilisé comme acquis.',
        ),
        h('14. Suivi et évaluation'),
        p(
          'Comment l’équipe saura que les objectifs sont atteints : indicateurs, moments de vérification, recueil de l’avis des bénéficiaires, bilan financier avec pièces justificatives. On y précise aussi qui assurera l’entretien ou la continuité des réalisations après l’Entreprise.',
        ),
        h('15. Conclusion'),
        p(
          'Les modèles donnent seulement le titre de cette partie. Il est conseillé d’y rappeler en quelques lignes le besoin, la réponse proposée, l’engagement de l’équipe et ce qui est attendu des lecteurs (accord, soutien, partenariat).',
        ),
        h('Pièces à conserver'),
        p(
          'Le Guide demande de conserver : compte rendu de décision, diagnostic, lettres d’accord, devis, budget, plan de prévention, feuilles de présence, justificatifs de dépenses, preuves de réalisation et bilan final.',
        ),
        h('Conseils de rédaction'),
        ul(
          'Écrire des phrases courtes et des chiffres vérifiables.',
          'Ne pas publier de nom, de photographie ou d’information personnelle sur un bénéficiaire sans son accord.',
          'Faire relire le dossier par un routier qui n’a pas participé à sa rédaction.',
        ),
        reflect(
          'Quelle partie du dossier serait la plus difficile à écrire pour ton équipe, et pourquoi ?',
        ),
        fiche7('p. 5 et 6'),
        ossature(),
        guide('p. 2, 6 et 7'),
      ),
    },
    // ─── E. Budget et financement ─────────────────────────────────────────
    {
      title: 'Budget et financement',
      content: doc(
        p(
          'Le budget doit être précis, transparent, basé sur des quantités et, autant que possible, sur des devis. C’est l’estimation honnête du coût des moyens nécessaires.',
        ),
        h('Deux catégories de coûts'),
        ul(
          'Coûts d’investissement : matériel, machines, véhicule, constructions et tout équipement dont la durée d’utilisation dépasse une année.',
          'Coûts de fonctionnement : frais de gestion quotidienne et administrative du projet, par exemple transport, carburant, consommables, fournitures, communication, restauration.',
        ),
        h('Quantités, prix unitaires et justificatifs'),
        p(
          'Chaque ligne du budget indique un poste, une quantité, un prix unitaire et un montant : montant = quantité × prix unitaire. Le prix unitaire s’appuie sur un devis, une facture pro forma ou un relevé de prix ; ce justificatif est conservé.',
        ),
        ...example(
          p(
            'Calcul seulement, montants fictifs : 4 brouettes × 25 000 FCFA = 100 000 FCFA. La ligne renvoie au devis n° 1.',
          ),
        ),
        h('Financements confirmés et financements recherchés'),
        p(
          'Le tableau de financement du Guide distingue, pour chaque source, le montant prévu et le montant acquis : apport des routiers, activités d’autofinancement, dons et partenariats. Un financement n’est acquis que lorsqu’il est reçu ou confirmé par écrit ; tant qu’il est seulement sollicité, il reste « recherché ».',
        ),
        h('Les contributions en nature'),
        p(
          'Le prêt de matériel, un transport offert ou le temps de bénévolat ont une valeur, mais ils ne sont pas de l’argent. Le Guide demande de les valoriser à part, sans les mélanger aux apports financiers.',
        ),
        h('Le seuil historique d’un tiers'),
        p(
          'L’ancienne méthodologie (fiche n° 7, ossature) demandait un apport personnel des organisateurs égal ou supérieur au tiers du budget, le reste venant des partenaires, des sponsors, des dons et legs. Le Guide de la communauté présente ce seuil comme un repère historique à vérifier auprès de l’encadrement compétent avant de l’appliquer comme obligation. La plateforme ne l’impose pas.',
        ),
        h('Suivre les dépenses'),
        p(
          'Le Guide demande de désigner un responsable de la tenue de caisse et de prévoir une validation des dépenses. Chaque dépense réelle est appuyée par un reçu. La dépense prévue est celle du budget ; la dépense réelle est celle du reçu. Tout écart est noté et expliqué.',
        ),
        ...example(
          p(
            'Montants fictifs : poste « transport » prévu à 100 000 FCFA, dépense réelle de 112 000 FCFA. L’écart de 12 000 FCFA est expliqué (hausse du prix du trajet) et compensé par une économie sur un autre poste, décidée avec la trésorerie.',
          ),
        ),
        reflect(
          'Pourquoi est-il dangereux de compter comme acquis un financement seulement promis oralement ?',
        ),
        fiche7('p. 6'),
        ossature(),
        guide('p. 6 et 7'),
      ),
    },
    // ─── F. Réaliser ──────────────────────────────────────────────────────
    {
      title: 'Réaliser l’Entreprise',
      content: doc(
        p(
          'La réalisation met en jeu le travail en équipe et l’engagement concret au service des autres. Le Guide y associe quatre exigences : actions sur le terrain, suivi des dépenses, sécurité et coordination. Le coordinateur accompagne sans diriger.',
        ),
        h('Coordination'),
        p(
          'La coordination opérationnelle tient le plan d’action à jour et organise des points d’étape réguliers. La fiche de suivi d’exécution indique, pour chaque action, le responsable, l’échéance et l’état d’avancement ou l’obstacle rencontré.',
        ),
        h('Exécution des activités'),
        p(
          'Les activités se déroulent dans l’ordre prévu. Chacun connaît sa tâche, son échéance et la personne à prévenir en cas de difficulté. Les présences sont notées sur des feuilles de présence, conservées avec le dossier.',
        ),
        h('Sécurité'),
        p(
          'Le plan de prévention est appliqué. Les interventions techniques sont confiées à des professionnels qualifiés. Les règles de l’association et de la communauté sur la protection des participants, notamment des enfants, s’appliquent sans exception.',
        ),
        h('Gestion du matériel'),
        p(
          'La logistique tient l’inventaire : ce qui sort, ce qui revient, ce qui est consommé, ce qui est abîmé. Le matériel emprunté est rendu en bon état et à la date convenue.',
        ),
        h('Relations avec les bénéficiaires'),
        p(
          'On agit avec les bénéficiaires, pas seulement pour eux. On respecte leur dignité, leurs usages et leur temps. Aucune photographie n’est prise ou diffusée sans leur accord.',
        ),
        h('Gestion financière'),
        p(
          'La trésorerie enregistre chaque dépense avec son justificatif, compare le réel au prévu et alerte avant tout dépassement. Les dépenses sont validées selon la règle fixée lors de la préparation.',
        ),
        h('Suivi du calendrier et imprévus'),
        p(
          'Un retard se signale dès qu’il apparaît. Face à un imprévu (pluie, absence, matériel manquant, autorisation retardée), l’équipe s’informe, informe le coordinateur, décide ensemble de l’ajustement et le note dans la fiche de suivi.',
        ),
        quote('« Le scout obéit sans réplique et ne fait rien à moitié. » (loi scoute, article 7)'),
        reflect(
          'Un samedi, la moitié de l’équipe est absente le jour d’une action prévue avec des bénéficiaires. Que faites-vous, et qui prévenez-vous ?',
        ),
        sapf('p. 6'),
        base('p. 2'),
        guide('p. 2, 6, 7 et 9 (annexe B)'),
      ),
    },
    // ─── G. Évaluer ───────────────────────────────────────────────────────
    {
      title: 'Évaluer, relire et transmettre',
      content: doc(
        p(
          'L’Entreprise apprend à relire et évaluer son action. Le Guide demande de comparer les résultats obtenus aux objectifs, de recueillir l’avis des bénéficiaires, d’établir le bilan financier avec pièces justificatives et de décrire les compétences acquises par les routiers.',
        ),
        h('Résultats et objectifs'),
        p(
          'Pour chaque objectif spécifique, on reprend l’indicateur prévu et on note le résultat obtenu : atteint, en partie atteint ou non atteint. On cherche ensuite les causes des écarts, sans chercher de coupable.',
        ),
        h('Bilan financier'),
        p(
          'Le bilan compare le budget prévu aux dépenses réelles, explique les écarts et rassemble les justificatifs. Il est présenté à la communauté et, le cas échéant, aux partenaires.',
        ),
        h('Les bénéficiaires'),
        p(
          'Leur avis est recueilli : la réalisation répond-elle à leur besoin ? Le Guide demande que la communauté concernée soit associée au bilan comme elle l’a été aux décisions.',
        ),
        h('Difficultés et compétences acquises'),
        p(
          'On relit les difficultés rencontrées et les réponses apportées, puis ce que chacun a appris. Les sept dimensions éducatives servent de grille : qu’avons-nous vécu en équipe, avec les populations, pour nous-mêmes, dans la société, au service des autres, pour la nature, avec nos partenaires ?',
        ),
        h('Relecture collective'),
        p(
          'Le manuel fait du compagnonnage un temps fort de relecture personnelle et collective : le routier y approfondit le sens de son engagement et de son rôle dans la communauté.',
        ),
        h('Pérennité'),
        p(
          'Le Guide demande de préciser qui assurera l’entretien ou la continuité des réalisations après l’Entreprise : un point d’eau sans responsable de l’entretien ne durera pas.',
        ),
        h('Transmission'),
        p(
          'Le compagnonnage fait passer du faire au transmettre. L’équipe partage son expérience avec les plus jeunes, conserve son dossier et ses pièces, et note ce qu’elle referait et ce qu’elle changerait.',
        ),
        p(
          'Un projet réussi ne donne pas automatiquement droit à un brevet ou à un label : les conditions de reconnaissance sont fixées par les instances de la branche Route. La validation officielle des acquis reste une décision humaine du responsable.',
        ),
        reflect(
          'Qu’est-ce qui a fonctionné ? Qu’est-ce qui n’a pas fonctionné, et pourquoi ?',
          'Que transmettrais-tu à une équipe qui commence sa première Entreprise ?',
        ),
        sapf('p. 4 et 6'),
        guide('p. 2, 7, 8 et 9'),
      ),
    },
    {
      title: 'Étude de cas : des termes de référence (exemple externe)',
      content: doc(
        p(
          'Pour s’exercer à structurer un projet, il est utile d’étudier un document réel. Les termes de référence (TDR) du « Camp d’aptitudes formelles de développement routier » (CAFDR), préparés par une autre communauté du district, la communauté Martin Luther King, en sont un bon exemple.',
        ),
        p(
          'Attention : ce document n’est pas une Entreprise de la communauté Nikola Tesla, ni même une Entreprise. C’est une activité éducative de formation et d’évaluation. Il est étudié ici uniquement pour la qualité de sa structure.',
        ),
        h('Comment le document est construit'),
        ol(
          'Contexte et justification : pourquoi l’activité est organisée et à quoi elle doit servir.',
          'Objectifs : un objectif général, puis des objectifs spécifiques.',
          'Résultats attendus : ce qui doit être constaté à l’issue de l’activité.',
          'Méthodologie : les formats retenus (ateliers par étape, activités sportives, assises de la communauté).',
          'Conditions de participation.',
          'Évaluation des routiers : ce qui est observé à chaque étape et les critères annoncés.',
          'Programme : horaires, activités, publics visés et responsables.',
          'Conclusion : la finalité de l’activité et l’appel à l’implication de tous.',
        ),
        h('Ce que l’on peut en retenir pour un dossier d’Entreprise'),
        ul(
          'Distinguer l’objectif général des objectifs spécifiques, comme le demande le Guide.',
          'Formuler des résultats attendus vérifiables : « une feuille de route est définie » se constate.',
          'Adapter les ateliers au public : le CAFDR prévoit des panels différents selon l’étape des routiers.',
          'Indiquer pour chaque activité son public et son responsable, comme dans le chronogramme.',
          'Annoncer à l’avance les critères d’évaluation : engagement et participation, mise en application des compétences, capacité à collaborer et à prendre des initiatives, adhésion aux valeurs scoutes.',
        ),
        h('Les limites de l’exemple'),
        p(
          'Les dates, les coordonnées, la participation financière et les horaires de cet événement appartiennent à la communauté qui l’a organisé : ils ne sont pas repris ici et ne s’appliquent pas à Nikola Tesla. De même, ses critères d’évaluation ne sont pas des règles de la plateforme : à Nikola Tesla, la validation officielle des acquis reste une décision humaine du responsable.',
        ),
        reflect(
          'Reprends le plan des TDR pour une idée de projet de ton équipe : quel serait l’objectif général ? Quels deux résultats attendus pourrait-on constater à la fin ?',
        ),
        tdr('p. 2 à 6'),
        guide('p. 5 et 9'),
      ),
    },
    {
      title: 'Boîte à outils : les fiches pratiques',
      content: doc(
        p(
          'Le Guide de l’Entreprise propose des tableaux et des annexes que l’équipe remplit au fil du projet. Ils sont regroupés en neuf fiches pratiques, téléchargeables en PDF depuis la page de ce module (rubrique « Fiches pratiques »). Ce sont des modèles vierges : ils ne contiennent aucun projet.',
        ),
        h('Les neuf fiches'),
        ol(
          'Grille de comparaison des projets : six critères sur cinq points, total sur trente, pour comparer les idées avant le vote.',
          'Procès-verbal de choix : la réunion, les projets présentés, le vote, la décision et les engagements.',
          'Fiche résumé de l’Entreprise : l’essentiel du projet sur une page, placée après la page de garde.',
          'Modèle de chronogramme : étapes, périodes, responsables et preuves attendues.',
          'Tableau de budget : postes, nature (investissement ou fonctionnement), quantités, prix unitaires, montants et justificatifs.',
          'Tableau de financement : montants prévus et acquis par source, contributions en nature valorisées à part.',
          'Fiche de suivi d’exécution : actions, responsables, échéances, obstacles, et suivi des dépenses prévues et réelles.',
          'Grille de bilan : objectifs et résultats, bilan financier, avis des bénéficiaires, continuité et sept dimensions éducatives.',
          'Checklist avant lancement : les sept conditions à réunir avant de commencer la réalisation.',
        ),
        h('Application pratique'),
        ul(
          'Chaque fiche a un responsable : la grille et le procès-verbal pour le secrétariat, le budget et le financement pour la trésorerie, le chronogramme et le suivi pour la coordination, le bilan pour la fonction suivi et évaluation.',
          'Les fiches remplies sont classées avec les pièces justificatives et jointes au dossier ou au bilan.',
          'Une fiche se met à jour : la date de la dernière modification est notée en haut.',
        ),
        conclude(
          'L’Entreprise est un service collectif qui répond à un besoin réel ; elle n’est pas une collecte de fonds.',
          'Elle suit des étapes claires : observer et choisir, préparer, rédiger, réaliser, évaluer et transmettre.',
          'Les décisions se prennent ensemble et se consignent ; les dépenses se prévoient, se justifient et se comparent au réel.',
          'Le coordinateur accompagne ; les routiers portent le projet.',
        ),
        guide('p. 2, 3, 6, 7 et 9 (annexes A à C)'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Compagnonnage'),
    note(
      'INFORMATION',
      null,
      `Sources complémentaires versées le 2026-11-02 (docs/sources/) : ${GUIDE_DOCUMENT} (SHA-256 ${GUIDE_SHA256}) ; « METHODOLOGIE ENTREPRISE.pdf », fiche technique n° 7 (SHA-256 ${FICHE7_SHA256}) ; « Ossature de rédaction de l’Entreprise route.docx » (SHA-256 ${OSSATURE_SHA256}) ; TDR du CAFDR (SHA-256 ${TDR_SHA256}), exemple externe dont les coordonnées, la participation financière et le calendrier ne sont pas repris. Pages citées : pages du PDF.`,
    ),
    note(
      'A_VERIFIER',
      8,
      'Apport personnel d’au moins un tiers du budget : règle de l’ancienne méthodologie, présentée comme repère historique (Guide p. 7). Confirmer auprès de l’encadrement compétent s’il s’applique aux Entreprises de la communauté.',
    ),
    note(
      'A_VERIFIER',
      0,
      'Durées de l’Entreprise (8, 5 ou 3 mois selon le tableau synoptique ; deuxième année selon la fiche n° 7) : présentées comme repères, aucune règle appliquée. Voir docs/REFERENTIEL_PEDAGOGIQUE.md § 5.',
    ),
    note(
      'A_VERIFIER',
      null,
      'Ajouts pédagogiques à valider : contenu conseillé du procès-verbal (leçon 4), méthode d’analyse des risques (leçon 6), conseils pour la conclusion et la rédaction (leçon 8), exemples illustratifs à montants fictifs (leçon 9). Les exemples sont signalés « Exemple (illustratif) ».',
    ),
    note(
      'A_VERIFIER',
      11,
      'Étude de cas : TDR du CAFDR de la communauté Martin Luther King, utilisé comme exemple externe de structuration (ni Entreprise, ni activité de Nikola Tesla). Confirmer que la communauté organisatrice accepte cette citation pédagogique.',
    ),
    note(
      'INFORMATION',
      12,
      'Fiches pratiques : neuf modèles vierges définis dans @tesla/shared (PRACTICAL_SHEETS) et rendus en PDF par l’API (GET /modules/:slug/sheets/:key/pdf), affichés sur la page du module publié. Aucun projet fictif.',
    ),
  ],
};

/** Domaine d'action : texte du manuel et du Guide, ajouts pédagogiques et exemples signalés. */
interface DomainLesson {
  title: ActionDomain;
  /** Définition du manuel SAPF-Route. */
  definition: string;
  /** Pistes de projets du Guide Nikola Tesla (p. 8). */
  guidePistes: string;
  /** Phrase du manuel sur ce que le routier apprend, développée. */
  objective: string[];
  society: string;
  examples: string[];
  skills: string[];
  distinguish: string[];
  precautions: string[];
  programmes: string[];
  reflection: string[];
  sapfPages: string;
  extra?: LessonBlock[];
}

const domain = (lesson: DomainLesson) => ({
  title: lesson.title,
  content: doc(
    h('Définition'),
    p(lesson.definition),
    p(`Pistes de projets retenues par le Guide de l’Entreprise : ${lesson.guidePistes}`),
    h('Objectif éducatif'),
    ...lesson.objective.map(p),
    h('Intérêt pour la société'),
    p(lesson.society),
    h('Exemples d’Entreprise (proposition pédagogique)'),
    p(
      'Pistes à adapter après un diagnostic mené avec les bénéficiaires. Aucune n’est un projet déjà réalisé par la communauté.',
    ),
    ul(...lesson.examples),
    h('Compétences développées'),
    ul(...lesson.skills),
    h('À distinguer des domaines proches'),
    ul(...lesson.distinguish),
    h('Précautions particulières'),
    ul(...lesson.precautions),
    h('Programmes OMMS cités par le manuel'),
    p(
      'Le manuel rattache ce domaine aux programmes suivants. Leur disponibilité et leurs conditions sont à vérifier auprès de l’association avant toute inscription.',
    ),
    ul(...lesson.programmes),
    lesson.extra ?? [],
    reflect(...lesson.reflection),
    sapf(lesson.sapfPages),
    guide('p. 8'),
  ),
});

const M10: SourceModule = {
  key: 'NT-ROUTE-M10',
  slug: 'route-m10-domaines-d-action-de-l-entreprise',
  title: 'Domaines d’action de l’Entreprise',
  summary:
    'Les dix domaines d’action de l’Entreprise, un par leçon : définition, objectif éducatif, intérêt pour la société, pistes de projets, compétences, précautions et réflexion. Un projet relève d’un domaine principal, parfois complété par d’autres.',
  objectives: [
    'Identifier les dix domaines d’action retenus par le manuel SAPF-Route et le Guide de l’Entreprise Nikola Tesla 2026–2027.',
    'Associer une idée d’Entreprise à son domaine principal et distinguer les domaines proches.',
    'Justifier le choix d’un domaine principal et de domaines complémentaires à partir d’un besoin réel.',
    'Repérer les précautions propres à chaque domaine.',
  ],
  stageCode: 'COMPAGNONNAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages:
    'SAPF-Route p. 6 à 8 ; Guide de l’Entreprise Nikola Tesla p. 8 ; fiche technique n° 7 p. 2 et 7 à 10 (historique)',
  lessons: [
    domain({
      title: 'Santé et sport',
      definition:
        'Ce domaine vise la promotion d’un mode de vie sain, l’équilibre physique et mental, ainsi que la prévention des comportements à risque. Les entreprises peuvent porter sur la sensibilisation à la santé, l’organisation d’activités sportives éducatives ou l’accompagnement de populations vulnérables.',
      guidePistes: 'prévention, santé communautaire, activité physique éducative.',
      objective: [
        'Selon le manuel, le routier apprend à prendre soin de lui-même et à promouvoir la santé comme un enjeu communautaire.',
        'Le scoutisme a toujours fait une large place à la santé et à la pratique du sport : on développe son corps en s’entraînant, en se fatiguant sans forcer, pour rester en bonne santé.',
      ],
      society:
        'Une population informée prévient mieux les maladies et recourt plus tôt aux soins. Le sport éducatif rassemble, apprend les règles et le respect de l’adversaire, et offre aux jeunes un cadre sain.',
      examples: [
        'Campagne de sensibilisation à une maladie courante, menée avec des professionnels de santé.',
        'Tournoi sportif éducatif pour les jeunes d’une paroisse, avec un temps d’échange sur l’hygiène de vie.',
        'Appui logistique bénévole à une compétition handisport organisée par une structure compétente.',
      ],
      skills: [
        'Organiser une action de prévention avec des partenaires qualifiés.',
        'Animer un groupe et faire respecter des règles de jeu.',
        'Communiquer un message de santé simple et exact.',
        'Prendre soin de sa propre condition physique.',
      ],
      distinguish: [
        'Éducation sexuelle : la prévention liée à l’affectivité et à la sexualité relève de ce domaine distinct.',
        'Développement social : l’accompagnement de malades démunis peut relever des deux ; le domaine principal dépend de l’objectif (soin et prévention, ou lutte contre la précarité).',
        'Dans l’ancienne fiche n° 7, « Santé » et « Sport » étaient deux labels distincts ; le référentiel actuel les réunit en un seul domaine.',
      ],
      precautions: [
        'Aucun acte médical par les routiers : diagnostic, soins, dépistage et conseils thérapeutiques relèvent de professionnels qualifiés.',
        'Messages de santé vérifiés auprès d’une source fiable ou d’un professionnel.',
        'Activités physiques adaptées à l’âge et à la condition des participants, avec de quoi boire et se reposer.',
        'Confidentialité absolue sur l’état de santé des personnes rencontrées.',
      ],
      programmes: [
        'LifeLeaders : développement des compétences de vie et du bien-être personnel.',
        'Scouts for SDGs (ODD 3 – Bonne santé et bien-être).',
      ],
      reflection: [
        'Quel comportement à risque observes-tu chez les jeunes de ton entourage ? Quelle action de prévention serait utile, et avec quel professionnel ?',
      ],
      sapfPages: 'p. 6',
    }),
    domain({
      title: 'Développement social',
      definition:
        'Ce domaine regroupe les actions de solidarité, d’inclusion sociale, de lutte contre la pauvreté et d’accompagnement des communautés défavorisées.',
      guidePistes: 'solidarité, inclusion, lutte contre la précarité.',
      objective: [
        'Selon le manuel, le routier découvre sa capacité à transformer concrètement son environnement social.',
        'La fiche n° 7 le formule ainsi : les besoins immenses et les bonnes intentions ne suffisent pas, il faut agir, au travers d’actions efficaces et en collaboration avec des partenaires.',
      ],
      society:
        'Les actions de solidarité soulagent des situations de précarité, renforcent les liens entre les habitants et aident des personnes isolées ou défavorisées à retrouver leur place dans la communauté.',
      examples: [
        'Collecte et distribution de fournitures scolaires avec une structure d’accueil qui connaît les familles.',
        'Réhabilitation d’un local communautaire avec ses usagers.',
        'Soirée de sensibilisation à la solidarité au sein du groupe ou de la paroisse.',
      ],
      skills: [
        'Écouter les personnes concernées et partir de leurs besoins.',
        'Travailler avec un partenaire social (association caritative, structure d’accueil, paroisse).',
        'Organiser une collecte transparente et en rendre compte.',
        'Respecter la dignité des personnes aidées.',
      ],
      distinguish: [
        'Éducation et protection de l’enfance : si les bénéficiaires principaux sont des enfants et que l’objectif est éducatif ou protecteur, ce domaine est le domaine principal.',
        'Agro-pastorale : un projet de sécurité alimentaire par la production agricole relève d’abord de l’agro-pastorale.',
        'Santé et sport : une action centrée sur le soin ou la prévention relève d’abord de la santé.',
      ],
      precautions: [
        'Respecter la dignité des bénéficiaires : pas de photographie humiliante, aucune diffusion sans accord.',
        'Préférer agir avec les personnes plutôt que distribuer pour elles ; prévoir ce qui se passe après l’action.',
        'Tenir une comptabilité claire des dons reçus et distribués.',
        'Passer par une structure qui connaît les familles pour identifier les bénéficiaires.',
      ],
      programmes: [
        'Messengers of Peace : promotion de la solidarité, de la cohésion sociale et du dialogue.',
        'Scouts for SDGs (ODD 1, 10, 11).',
      ],
      reflection: [
        'Quelle différence fais-tu entre « donner » et « agir avec » ? Comment une distribution peut-elle devenir un vrai projet de développement social ?',
      ],
      sapfPages: 'p. 6 et 7',
    }),
    domain({
      title: 'Éducation à la paix',
      definition:
        'Ce domaine concerne la promotion de la paix, du dialogue, de la citoyenneté et de la résolution non violente des conflits.',
      guidePistes: 'dialogue, citoyenneté, médiation et cohésion.',
      objective: [
        'Selon le manuel, le routier devient acteur du vivre-ensemble et apprend à gérer les conflits avec maturité.',
        'La fiche n° 7 rappelle que la paix est toujours fragile : il reste tant à faire pour que s’instaurent entre les personnes une meilleure compréhension, davantage de tolérance et de respect.',
      ],
      society:
        'Le dialogue entre groupes qui se méfient, la médiation et l’éducation à la citoyenneté réduisent les tensions et préparent une société plus juste et plus solidaire.',
      examples: [
        'Ateliers de dialogue entre jeunes de quartiers ou de communautés différentes.',
        'Animation d’un débat citoyen dans un établissement scolaire, avec l’accord de sa direction.',
        'Journée sportive ou culturelle de cohésion réunissant des groupes qui se côtoient peu.',
      ],
      skills: [
        'Écouter des points de vue opposés sans les juger.',
        'Animer un échange respectueux et reformuler.',
        'Comprendre les mécanismes d’un conflit et les voies non violentes pour le dépasser.',
        'Exercer sa citoyenneté de manière responsable.',
      ],
      distinguish: [
        'Vie et foi : une rencontre interreligieuse dont le but premier est la prière ou le témoignage relève de « Vie et foi » ; si le but premier est la cohésion entre communautés, elle relève de l’éducation à la paix.',
        'Art et culture : un spectacle interculturel relève de la paix si son objectif est le dialogue, de l’art et de la culture si son objectif est l’expression ou la valorisation du patrimoine.',
      ],
      precautions: [
        'Rester neutre : le scoutisme est apolitique ; aucune action partisane.',
        'Ne pas s’improviser médiateur dans un conflit grave : s’appuyer sur des personnes formées et sur les autorités locales.',
        'Évaluer la sécurité du lieu et du contexte avant toute rencontre entre groupes en tension.',
        'Garantir à chacun un espace de parole respectueux.',
      ],
      programmes: ['Dialogue for Peace.', 'Messengers of Peace.', 'Scouts of the World Award.'],
      reflection: [
        'Pense à un conflit que tu as vécu dans ton équipe. Qu’est-ce qui a permis, ou aurait permis, de le dépasser sans violence ?',
      ],
      sapfPages: 'p. 7',
    }),
    domain({
      title: 'Environnement',
      definition:
        'Ce domaine vise la protection de la nature, la lutte contre le changement climatique et la sensibilisation aux comportements écoresponsables.',
      guidePistes: 'protection de la nature, gestion des déchets, sensibilisation écologique.',
      objective: [
        'Selon le manuel, le routier développe une conscience écologique active et responsable.',
        'La fiche n° 7 propose de vivre dans la nature pour mieux la connaître et l’aimer, de s’intéresser aux questions environnementales dans leur complexité, d’agir pour les sols, l’eau, l’air, les plantes et les animaux, et de communiquer ses savoir-faire en matière d’écocitoyenneté.',
      ],
      society:
        'La gestion des déchets, la protection des espaces naturels et l’usage sage des ressources améliorent la santé et le cadre de vie de tous, aujourd’hui et pour les générations futures.',
      examples: [
        'Opération de ramassage et de tri des déchets plastiques sur une plage ou dans un quartier, avec la filière qui les reprend.',
        'Plantation et entretien d’arbres avec une école, en choisissant des espèces conseillées par un spécialiste.',
        'Campagne de sensibilisation aux gestes écoresponsables auprès des familles d’un quartier.',
      ],
      skills: [
        'Observer un milieu naturel et en comprendre les équilibres.',
        'Mobiliser des habitants autour d’une action concrète.',
        'Organiser une logistique de collecte et d’élimination des déchets.',
        'Sensibiliser sans culpabiliser.',
      ],
      distinguish: [
        'Agro-pastorale : un potager ou un élevage vise d’abord la production et l’autonomie alimentaire ; l’environnement vise d’abord la protection de la nature.',
        'Santé et sport : l’assainissement d’un quartier peut relever des deux ; le domaine principal dépend de l’objectif (protéger le milieu ou prévenir les maladies).',
      ],
      precautions: [
        'Prévoir où partent les déchets collectés : une collecte sans filière d’élimination déplace le problème.',
        'Gants, chaussures fermées et matériel adapté ; ne jamais manipuler de déchets dangereux (seringues, produits chimiques) : les signaler.',
        'Obtenir l’accord de la commune ou du propriétaire du site.',
        'Planter seulement après avis sur les espèces et prévoir qui arrosera et entretiendra.',
      ],
      programmes: [
        'Plastic Tide Turners : lutte contre la pollution plastique.',
        'Scouts Go Solar : promotion des énergies renouvelables.',
        'Earth Tribe : mobilisation mondiale des scouts pour la planète.',
        'Scouts for SDGs (ODD 13, 14, 15).',
      ],
      reflection: [
        'Quel problème environnemental vois-tu chaque jour sur ton trajet ? Qui pourrait agir avec vous pour le résoudre durablement ?',
      ],
      sapfPages: 'p. 7',
    }),
    domain({
      title: 'Éducation sexuelle',
      definition:
        'Ce domaine aborde l’éducation à l’affectivité, à la sexualité responsable, au respect du corps et à la prévention.',
      guidePistes: 'éducation à l’affectivité, respect du corps et prévention adaptée.',
      objective: [
        'Selon le manuel, le routier acquiert une vision responsable et respectueuse de la personne humaine.',
        'Il apprend à parler de ces sujets avec justesse, à respecter l’autre et lui-même, et à relayer une information de prévention exacte.',
      ],
      society:
        'Une information juste et respectueuse aide les jeunes à faire des choix responsables, à se protéger, à refuser les violences et à respecter l’égalité entre les femmes et les hommes.',
      examples: [
        'Causerie sur l’affectivité et le respect animée avec des professionnels de santé, auprès de jeunes adultes.',
        'Campagne de sensibilisation au respect et à l’égalité entre filles et garçons.',
        'Relais d’une campagne de prévention menée par une structure de santé reconnue.',
      ],
      skills: [
        'Aborder un sujet intime avec délicatesse et respect.',
        'Distinguer une information vérifiée d’une rumeur.',
        'Travailler avec des professionnels et respecter leur rôle.',
        'Garantir la confidentialité.',
      ],
      distinguish: [
        'Santé et sport : la prévention des maladies en général relève de la santé ; l’éducation à l’affectivité et à la sexualité relève de ce domaine.',
        'Éducation et protection de l’enfance : la prévention des abus envers les enfants relève d’abord de la protection de l’enfance.',
      ],
      precautions: [
        'Intervention animée ou validée par des professionnels qualifiés ; les routiers ne s’improvisent pas formateurs.',
        'Contenu adapté à l’âge du public et validé par l’encadrement, dans le respect du cadre éducatif de l’association.',
        'Aucun témoignage personnel exigé ; confidentialité de ce qui est dit.',
        'Toute situation de violence ou d’abus révélée est signalée au responsable, selon les règles de protection de l’association.',
      ],
      programmes: ['LifeLeaders.', 'Scouts for SDGs (ODD 3 et 5 – Santé et égalité des genres).'],
      reflection: [
        'Pourquoi ce domaine exige-t-il plus que d’autres l’appui de professionnels ? Quelles règles ton équipe se donnerait-elle avant d’agir ?',
      ],
      sapfPages: 'p. 7',
    }),
    domain({
      title: 'Agro-pastorale',
      definition:
        'Ce domaine concerne les actions liées à l’agriculture, à l’élevage, à la sécurité alimentaire et au développement rural.',
      guidePistes: 'agriculture, élevage, sécurité alimentaire et autonomie.',
      objective: [
        'Selon le manuel, le routier comprend les enjeux de l’autonomie alimentaire et du développement local durable.',
        'Il apprend un savoir-faire concret, la patience des cycles naturels et la valeur du travail de la terre.',
      ],
      society:
        'Produire localement améliore l’alimentation, crée des ressources pour une communauté ou une œuvre sociale et valorise les savoirs agricoles.',
      examples: [
        'Création d’un jardin potager communautaire avec une école ou une structure d’accueil.',
        'Appui à un petit élevage au profit d’une œuvre sociale, avec un technicien.',
        'Atelier de transformation ou de conservation de produits agricoles avec des producteurs locaux.',
      ],
      skills: [
        'Planifier une production selon les saisons.',
        'Apprendre des techniques auprès de producteurs ou de techniciens.',
        'Organiser un entretien régulier dans la durée.',
        'Gérer une petite activité productive et en rendre compte.',
      ],
      distinguish: [
        'Environnement : l’agro-pastorale vise la production et l’autonomie alimentaire ; l’environnement vise la protection de la nature. Un potager biologique peut avoir l’environnement comme domaine complémentaire.',
        'Développement social : si la production sert d’abord à lutter contre la précarité d’un groupe, le développement social peut être un domaine complémentaire justifié.',
      ],
      precautions: [
        'Accord écrit du propriétaire du terrain et accès à l’eau vérifié.',
        'Produits phytosanitaires et soins aux animaux confiés à des personnes compétentes.',
        'Outils manipulés avec prudence ; équipement adapté.',
        'Prévoir dès le départ qui entretiendra le jardin ou l’élevage après l’Entreprise.',
      ],
      programmes: [
        'Scouts for SDGs (ODD 2 – Faim zéro, ODD 12 – Consommation responsable).',
        'Projets Better World Framework liés au développement durable.',
      ],
      reflection: [
        'Un potager est créé avec enthousiasme, puis abandonné trois mois plus tard. Qu’aurait-il fallu prévoir dès la préparation ?',
      ],
      sapfPages: 'p. 7 et 8',
    }),
    domain({
      title: 'Vie et foi',
      definition:
        'Ce domaine regroupe les actions spirituelles, pastorales et de témoignage de foi, vécues dans le respect des convictions de chacun.',
      guidePistes: 'service pastoral, engagement spirituel et témoignage.',
      objective: [
        'Selon le manuel, le routier approfondit sa foi et apprend à la vivre comme source d’engagement et de service.',
        'La fiche n° 7 citait le pèlerinage, la nuit de l’Évangile, la pastorale des malades et l’animation chrétienne des rassemblements du mouvement.',
      ],
      society:
        'Les actions de ce domaine soutiennent la vie des communautés de foi, rejoignent des personnes seules ou malades et témoignent de valeurs de service et de fraternité.',
      examples: [
        'Service régulier auprès d’une paroisse (accueil, animation), en lien avec ses responsables.',
        'Visites régulières de malades ou de personnes âgées, avec une équipe de pastorale.',
        'Préparation et animation d’un temps spirituel lors d’un rassemblement du mouvement.',
      ],
      skills: [
        'Préparer et animer un temps de prière ou de célébration.',
        'Rejoindre des personnes fragiles avec délicatesse.',
        'Relire son action à la lumière de sa foi.',
        'Respecter les convictions de chacun.',
      ],
      distinguish: [
        'Éducation à la paix : une rencontre interreligieuse dont le but premier est le dialogue et la cohésion relève de l’éducation à la paix.',
        'Développement social : une action caritative portée par une paroisse peut relever des deux ; le domaine principal dépend de l’objectif.',
        'Dans l’ancienne fiche n° 7, ce domaine s’appelait « Engagement chrétien ».',
      ],
      precautions: [
        'Respect des convictions de chacun : aucune pression ni prosélytisme insistant.',
        'Coordination avec l’aumônier et les responsables de la paroisse ou de l’aumônerie.',
        'Auprès des malades : respect des horaires et des consignes du lieu, discrétion, hygiène.',
      ],
      programmes: [
        'Dialogue for Peace (dimension interreligieuse).',
        'Dimension spirituelle du Better World Framework.',
      ],
      reflection: [
        'Comment ta foi, ou tes convictions, nourrissent-elles ton envie de servir ? Comment respecter celles des autres dans un projet commun ?',
      ],
      sapfPages: 'p. 8',
    }),
    domain({
      title: 'Art et culture',
      definition:
        'Ce domaine vise la promotion de la créativité, de l’expression artistique et de la valorisation du patrimoine culturel.',
      guidePistes: 'patrimoine, expression artistique, dialogue culturel.',
      objective: [
        'Selon le manuel, le routier développe son identité culturelle et sa capacité à dialoguer avec les autres cultures.',
        'Il découvre la richesse du patrimoine, exerce sa créativité et apprend à la mettre au service des autres.',
      ],
      society:
        'Valoriser un patrimoine, transmettre des contes, des chants ou des savoir-faire, et offrir des espaces d’expression renforce l’identité d’une communauté et le respect entre les cultures.',
      examples: [
        'Exposition sur le patrimoine d’une commune d’Abidjan, préparée avec des personnes ressources.',
        'Atelier de contes et de chants traditionnels pour des enfants, avec des anciens du quartier.',
        'Montage d’un spectacle pour les enfants d’une structure d’accueil.',
      ],
      skills: [
        'Rechercher et vérifier des informations sur un patrimoine.',
        'Créer et présenter une œuvre collective.',
        'Interroger des personnes ressources avec respect.',
        'Organiser un événement culturel.',
      ],
      distinguish: [
        'Éducation à la paix : si l’objectif premier est le dialogue entre groupes, c’est l’éducation à la paix.',
        'Éducation et protection de l’enfance : un spectacle pour enfants dont l’objectif est éducatif peut avoir ce domaine comme domaine principal ; l’art et la culture deviennent alors complémentaires.',
      ],
      precautions: [
        'Respecter les détenteurs d’un savoir ou d’un rite : demander leur accord, surtout pour les éléments sacrés.',
        'Droit à l’image et droits d’auteur : autorisations avant de photographier, filmer, reproduire ou diffuser.',
        'Citer ses sources et les personnes ressources.',
      ],
      programmes: [
        'Patrimonito : protection et valorisation du patrimoine culturel.',
        'Dialogue for Peace (dialogue interculturel).',
      ],
      reflection: [
        'Quel élément du patrimoine de ton quartier ou de ta région risque d’être oublié ? Qui pourrait vous aider à le transmettre ?',
      ],
      sapfPages: 'p. 8',
    }),
    domain({
      title: 'Éducation et protection de l’enfance',
      definition:
        'Ce domaine concerne l’éducation, la prévention des abus, la protection des enfants et l’encadrement éducatif.',
      guidePistes: 'soutien éducatif, protection et environnement sûr pour les enfants.',
      objective: [
        'Selon le manuel, le routier devient un adulte responsable, conscient de son rôle protecteur et éducatif.',
        'La fiche n° 7 citait la participation aux colonies de vacances, l’animation d’une bibliothèque mobile, le soutien scolaire, la réhabilitation d’une école primaire ou l’animation d’un grand jeu pour les enfants d’un quartier.',
      ],
      society:
        'Le soutien éducatif aide des enfants à réussir et à s’épanouir ; la prévention des abus et la création d’environnements sûrs protègent les plus vulnérables.',
      examples: [
        'Soutien scolaire régulier dans un centre d’accueil, avec l’accord et l’encadrement de ses responsables.',
        'Animation d’une bibliothèque mobile pour les enfants d’un quartier.',
        'Sensibilisation des parents à la protection de l’enfance, avec une structure spécialisée.',
      ],
      skills: [
        'Animer des activités adaptées à l’âge des enfants.',
        'Transmettre un savoir avec patience.',
        'Appliquer les règles de protection de l’enfance.',
        'Travailler avec des familles et des structures éducatives.',
      ],
      distinguish: [
        'Développement social : si l’action vise d’abord la précarité d’une famille, c’est le développement social ; si elle vise d’abord l’éducation ou la protection de l’enfant, c’est ce domaine.',
        'Éducation sexuelle : la prévention des abus envers les enfants relève de ce domaine ; l’éducation à l’affectivité de jeunes adultes relève de l’éducation sexuelle.',
        'TIC : un atelier numérique pour des élèves peut relever des deux ; le domaine principal dépend de l’objectif.',
      ],
      precautions: [
        'Jamais seul avec un enfant ; toujours en binôme et dans un lieu visible.',
        'Accord de la structure d’accueil et des parents ; respect de ses règles.',
        'Aucune photographie d’enfant sans autorisation, aucune diffusion de données le concernant.',
        'Toute inquiétude sur la sécurité d’un enfant est signalée au responsable, selon les règles de protection de l’association.',
      ],
      programmes: [
        'Safe from Harm : politique mondiale de protection de l’enfance.',
        'Messengers of Peace.',
      ],
      reflection: [
        'Quelles règles ton équipe doit-elle connaître et appliquer avant toute activité avec des enfants ? Qui les fixe ?',
      ],
      sapfPages: 'p. 8',
    }),
    domain({
      title: 'Technologies de l’information et de la communication',
      definition:
        'Ce domaine (TIC) regroupe les actions liées au numérique, à la communication et à l’usage responsable des technologies.',
      guidePistes: 'inclusion numérique, compétences digitales et usage responsable des TIC.',
      objective: [
        'Selon le manuel, le routier développe des compétences numériques utiles et apprend à utiliser la technologie au service du bien commun.',
        'Il apprend à transmettre ses compétences et à adopter lui-même un usage responsable des outils numériques.',
      ],
      society:
        'L’inclusion numérique ouvre l’accès à l’information, aux démarches et à la formation ; l’éducation aux usages responsables protège contre les arnaques, le harcèlement et les fausses informations.',
      examples: [
        'Initiation à l’informatique pour des personnes âgées ou des élèves.',
        'Atelier de sensibilisation à la sécurité en ligne et aux fausses informations.',
        'Aide à une association locale pour présenter ses activités en ligne, avec son accord.',
      ],
      skills: [
        'Expliquer un outil numérique à un débutant.',
        'Protéger des données personnelles et des comptes.',
        'Vérifier une information avant de la partager.',
        'Concevoir un support de communication clair.',
      ],
      distinguish: [
        'Éducation et protection de l’enfance : un atelier numérique pour des enfants peut relever des deux ; le domaine principal dépend de l’objectif (compétence numérique ou soutien éducatif).',
        'Art et culture : un film ou un site qui valorise un patrimoine relève d’abord de l’art et de la culture si le patrimoine est l’objectif ; le numérique est alors l’outil.',
      ],
      precautions: [
        'Protection des données personnelles : ne collecter que le nécessaire, avec l’accord des personnes.',
        'Aucune photographie ni vidéo diffusée sans autorisation, en particulier d’enfants.',
        'Un don de matériel n’a de sens qu’avec la formation et l’entretien qui l’accompagnent.',
        'Respect des licences des logiciels utilisés.',
      ],
      programmes: [
        'Scouts for SDGs (ODD 4 – Éducation de qualité).',
        'Initiatives numériques du Better World Framework.',
        'Programmes éducatifs type Scouts Go Digital (selon contextes nationaux).',
      ],
      reflection: [
        'Quelle compétence numérique maîtrises-tu et pourrais-tu transmettre ? À qui serait-elle la plus utile ?',
      ],
      sapfPages: 'p. 8',
      extra: conclude(
        'Le référentiel compte exactement dix domaines d’action ; les anciennes listes à cinq ou sept domaines sont historiques.',
        'Le domaine se choisit à partir d’un besoin réel, pas l’inverse.',
        'Un projet a un domaine principal ; les domaines complémentaires se justifient.',
        'Un projet pertinent ne donne pas automatiquement droit à un label ou à un brevet : les conditions de reconnaissance sont fixées par les instances de la branche Route.',
      ),
    }),
  ],
  notes: [
    ...commonNotes('Compagnonnage'),
    note(
      'INFORMATION',
      null,
      `Dix domaines confirmés par deux sources concordantes : manuel SAPF-Route p. 6 à 8 et ${GUIDE_DOCUMENT} p. 8 (SHA-256 ${GUIDE_SHA256}). Les listes de la fiche technique n° 7 (cinq domaines p. 2, sept labels p. 7) sont historiques ; rapprochements présentés dans les leçons : « Santé » et « Sport » → « Santé et sport » ; « Engagement chrétien » → « Vie et foi ». Aucun domaine supplémentaire.`,
    ),
    note(
      'A_VERIFIER',
      null,
      'Exemples d’Entreprise : propositions pédagogiques (certaines inspirées des exemples de la fiche n° 7), signalées dans chaque leçon. À valider ou remplacer par des exemples de la communauté.',
    ),
    note(
      'A_VERIFIER',
      null,
      'Programmes OMMS repris du manuel : disponibilité et conditions à confirmer auprès de l’association et des pages officielles de l’OMMS avant de les présenter comme actifs.',
    ),
    note(
      'A_VERIFIER',
      null,
      'Rubriques « Intérêt pour la société », « Compétences développées », « À distinguer des domaines proches » et « Précautions particulières » : recommandations pédagogiques, non tirées d’un règlement. Les règles officielles de protection (enfance, santé, image) de l’association prévalent.',
    ),
    note(
      'A_VERIFIER',
      9,
      'Label de domaine d’action : le manuel l’associe à l’Entreprise (tableau synoptique) ; le Guide (p. 8) précise que noms des labels et conditions de reconnaissance sont à confirmer auprès des instances de la branche Route. Aucune attribution automatique.',
    ),
  ],
};

// ─── DÉPART ROUTIER ────────────────────────────────────────────────────────

const M11: SourceModule = {
  key: 'NT-ROUTE-M11',
  slug: 'route-m11-service-et-engagement-personnel',
  title: 'Service et engagement personnel',
  summary:
    'Du service proposé au service choisi : un engagement personnel, libre et durable au service des autres.',
  objectives: [
    'Expliquer le sens du service à l’étape du Départ routier.',
    'Choisir un engagement personnel de service.',
    'Relire cet engagement avec un accompagnateur.',
  ],
  stageCode: 'DEPART_ROUTIER',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 2, 4, 5 et 9',
  lessons: [
    {
      title: 'Le sens du service',
      content: doc(
        p(
          'Le service constitue l’aboutissement du parcours routier. Il ne s’agit plus seulement d’actions ponctuelles ou de projets collectifs, mais d’un choix personnel et durable d’engagement au service des autres et de la société.',
        ),
        p(
          'Le tableau synoptique consacre au Service 6 mois (18 ans), 3 mois (19 ans) ou 1 mois (20 ans) ; l’attribut associé est l’étoile or.',
        ),
        sapf('p. 4'),
      ),
    },
    {
      title: 'L’engagement volontaire',
      content: doc(
        p(
          'Le routier apprend à servir non plus parce qu’on le lui propose, mais parce qu’il l’a choisi. Son engagement est assumé librement et inscrit dans la durée.',
        ),
        p(
          'Cette étape est déterminante : elle permet au jeune de donner une orientation concrète à sa vie d’adulte. Il en retire une cohérence entre ses valeurs et ses actes, une maturité humaine et spirituelle renforcée, et la capacité de s’engager dans le monde avec responsabilité et liberté.',
        ),
        reflect('Qu’est-ce qui rend un engagement durable ?'),
        sapf('p. 4'),
      ),
    },
    {
      title: 'La responsabilité sociale',
      content: doc(
        p(
          'L’engagement personnel peut prendre la forme d’un service associatif, social, ecclésial ou citoyen. Le Départ routier peut se vivre soit en branche, soit dans une ONG.',
        ),
        p(
          'Le routier y trouve une cohérence entre ses valeurs et ses actes, et la capacité de s’engager dans le monde avec responsabilité et liberté.',
        ),
        sapf('p. 4 et 5'),
      ),
    },
    {
      title: 'Le projet personnel de service',
      content: doc(
        p(
          'À cette étape, l’itinéraire du routier devient plus individualisé, tout en restant relié à la vie communautaire. Il choisit un service personnel, vécu dans la durée.',
        ),
        reflect(
          'Dans quelle structure, en branche ou ailleurs, aimerais-tu servir ?',
          'Quel temps peux-tu y consacrer de façon régulière ?',
        ),
        sapf('p. 4 et 9'),
      ),
    },
    {
      title: 'L’accompagnement',
      content: doc(
        p(
          'Des temps d’accompagnement, de relecture et de témoignage soutiennent ce cheminement et préparent le départ routier.',
        ),
        p(
          'Le coordinateur aide les routiers à discerner leur chemin ; il accompagne sans se substituer.',
        ),
        p(
          'Il veille à la qualité de la progression collective et individuelle et maintient une exigence éducative juste : il encourage sans diriger et rappelle le cap lorsque l’essentiel se dilue.',
        ),
        reflect(
          'Qui t’accompagne aujourd’hui ? Quand avez-vous fait le point pour la dernière fois ?',
        ),
        sapf('p. 2 et 4'),
      ),
    },
    {
      title: 'La relecture de l’engagement',
      content: doc(
        p(
          'La relecture permet de vérifier la cohérence entre ce que l’on dit et ce que l’on fait, et de nourrir une maturité humaine et spirituelle.',
        ),
        reflect(
          'Ce service correspond-il à ce que tu avais choisi au départ ?',
          'Qu’a-t-il changé en toi ?',
        ),
        conclude(
          'À la Route, le service devient un choix personnel et durable.',
          'Il peut se vivre en branche ou hors de la branche.',
          'Il s’accompagne et se relit.',
        ),
        sapf('p. 4'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Départ routier'),
    overlap('NT-DEC-B11 « Responsabilités et esprit de service »'),
    note(
      'A_COMPLETER',
      3,
      'Forme du projet personnel de service (contenu, durée minimale, structure d’accueil, validation) : non définie par le manuel. Ne pas la présenter comme une obligation.',
    ),
  ],
};

const M12: SourceModule = {
  key: 'NT-ROUTE-M12',
  slug: 'route-m12-preparation-au-depart-routier',
  title: 'Préparation au Départ routier',
  summary:
    'Relire tout son parcours, se préparer personnellement et spirituellement, et vivre la cérémonie de départ comme un envoi.',
  objectives: [
    'Comprendre le Départ routier comme un envoi, non comme une fin.',
    'Faire le bilan de son parcours.',
    'Connaître les repères de la cérémonie de départ.',
  ],
  stageCode: 'DEPART_ROUTIER',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 4, 5, 9 et 10',
  lessons: [
    {
      title: 'Comprendre le Départ routier',
      content: doc(
        p(
          'Le départ routier constitue l’achèvement du parcours scout à la Route. Il ne marque pas une fin, mais un envoi dans la société. Le routier est reconnu comme un adulte éduqué, capable de porter les valeurs de la Route au-delà du cadre scout.',
        ),
        p(
          'Il couronne une étape vécue sur une année scoute : un service personnel dans la durée, des temps de relecture approfondie, des échanges avec le coordinateur et la communauté, et la préparation spirituelle de l’envoi.',
        ),
        h('Ne pas confondre'),
        p(
          'Le Départ routier est une démarche d’engagement personnel, préparée et reconnue par la communauté. Il ne se confond pas avec la sortie de la branche au 21e anniversaire, qui est une règle d’âge de la communauté.',
        ),
        sapf('p. 4 et 9'),
      ),
    },
    {
      title: 'Bilan du parcours',
      content: doc(
        p(
          'Le départ permet au jeune de donner une cohérence à tout son parcours. Il reconnaît le chemin accompli et l’oriente vers l’avenir.',
        ),
        reflect(
          'Quels ont été les moments forts de ton Noviciat, de ton Apprentissage et de ton Compagnonnage ?',
          'Qu’est-ce qui a le plus changé en toi depuis ton arrivée ?',
        ),
        sapf('p. 9'),
      ),
    },
    {
      title: 'Préparation personnelle',
      content: doc(
        p(
          'Les activités clés précédant le départ routier sont un service personnel vécu dans la durée, des temps de relecture approfondie et des échanges avec le coordinateur et la communauté.',
        ),
        p(
          'Ces activités ne sont pas une liste à cocher : elles aident le routier à rassembler ce qu’il a vécu pour pouvoir le porter au-delà du cadre scout.',
        ),
        reflect(
          'Quel service vis-tu aujourd’hui dans la durée ?',
          'Avec qui, dans la communauté, aimerais-tu relire ton parcours avant ton départ ?',
        ),
        sapf('p. 9'),
      ),
    },
    {
      title: 'Préparation spirituelle',
      content: doc(
        p(
          'La préparation spirituelle de l’envoi fait partie des activités qui précèdent le départ. Elle s’inscrit dans la croissance humaine et spirituelle que vise toute la Route.',
        ),
        p(
          'La Prière de la Route peut accompagner ce temps (bibliothèque, rubrique « Textes fondamentaux »).',
        ),
        sapf('p. 2 et 9'),
      ),
    },
    {
      title: 'La cérémonie de départ',
      content: doc(
        p(
          'La cérémonie doit être solennelle, préparée avec sérieux et vécue comme un acte de transmission.',
        ),
        h('Repères pratiques'),
        ul(
          'Moment : à la fin de la quatrième étape.',
          'Rassemblement : en rectangle.',
          'Acteurs : le ou les routiers en fin de service, les équipes, la maîtrise routier, le parrain, l’aumônier.',
          'Objets et symboles : la Bible, la boussole, la bougie, l’étendard.',
        ),
        p(
          'Le tableau synoptique consacre à l’Envoi 3 mois (18 ans) ou 1 mois (19 et 20 ans) ; l’attribut associé est la Bible.',
        ),
        sapf('p. 5 et 10'),
      ),
    },
    {
      title: 'L’engagement après la Route',
      content: doc(
        p(
          'Le routier en retire un sentiment d’accomplissement, une légitimité à s’engager dans la société et la conscience d’être envoyé, et non simplement de quitter la communauté.',
        ),
        p(
          'Fidèle à l’intuition de Baden-Powell, la Route forme des adultes capables de servir avec audace, de s’engager avec discernement et de prendre leur place dans la société en adultes responsables et libres.',
        ),
        reflect('Où et comment comptes-tu continuer à servir après la Route ?'),
        conclude(
          'Le départ est un envoi, pas une sortie.',
          'Il se prépare par le service, la relecture et la prière.',
          'La cérémonie est un acte de transmission.',
        ),
        sapf('p. 2 et 9'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Départ routier'),
    overlap('NT-DEC-D22 « Comprendre le Départ routier »'),
    note(
      'A_COMPLETER',
      3,
      'Contenu de la préparation spirituelle (temps de prière, retraite, accompagnement de l’aumônier) : non décrit par le manuel.',
    ),
    note(
      'A_COMPLETER',
      4,
      'Rôle du parrain, sens de la boussole et de la bougie, déroulement de la cérémonie : non développés par le manuel.',
    ),
    note(
      'INFORMATION',
      0,
      'Le Départ routier est distinct de la sortie de la branche au 21e anniversaire (règle de la communauté) : la leçon 1 le précise (révision 2) ; aucune étape n’est attribuée à la sortie.',
    ),
  ],
};

/** Textes fondamentaux : importés avant les modules qui les citent. */
export const FUNDAMENTAL_TEXTS: SourceModule[] = [PRIERE];

/** Modules du catalogue initial créés par ce seed (01 et 02 : brouillons NT-SCOUT-M01/M02 existants). */
export const ROUTE_MODULES: SourceModule[] = [M03, M04, M05, M06, M07, M08, M09, M10, M11, M12];

/** Correspondance des 12 modules du catalogue avec les codes source. */
export const ROUTE_CATALOG: readonly { number: number; key: string; reused: boolean }[] = [
  { number: 1, key: 'NT-SCOUT-M01', reused: true },
  { number: 2, key: 'NT-SCOUT-M02', reused: true },
  ...ROUTE_MODULES.map((module, index) => ({ number: index + 3, key: module.key, reused: false })),
];
