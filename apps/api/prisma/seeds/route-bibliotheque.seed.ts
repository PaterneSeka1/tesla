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
import { type LessonBlock, type LessonDocument, type SourceEditorialNote } from '@tesla/shared';
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
    'A_COMPLETER',
    null,
    'Évaluation à préparer : aucun questionnaire n’a été créé. Les questions « Pour réfléchir » sont des supports de relecture, pas une évaluation.',
  ),
];

/** Rapprochement avec un brouillon vide du catalogue « Découvrir la Route » (aucune fusion automatique). */
const overlap = (keys: string) =>
  note(
    'INFORMATION',
    null,
    `Sujet également couvert par le(s) brouillon(s) vide(s) ${keys} (catalogue « Découvrir la Route ») : le responsable peut les archiver ou y reporter ce contenu. Aucune fusion automatique.`,
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
    'Décrire la cérémonie d’engagement et la remise des flots.',
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
      3,
      'Déroulement, formule d’engagement et rôle de chacun pendant la cérémonie : non décrits dans le manuel (dépendent de la Charte et des usages de la communauté).',
    ),
    note(
      'A_COMPLETER',
      5,
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

const M09: SourceModule = {
  key: 'NT-ROUTE-M09',
  slug: 'route-m09-l-entreprise-routiere',
  title: 'L’Entreprise routière',
  summary:
    'Le cœur de la pédagogie de la Route : un projet collectif qui répond à un besoin réel de la société.',
  objectives: [
    'Définir l’Entreprise et son rôle dans la formation par l’action.',
    'Conduire les étapes d’un projet : besoin, objectifs, planification, réalisation, évaluation, bilan.',
    'Transmettre l’expérience acquise.',
  ],
  stageCode: 'COMPAGNONNAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 3 à 6',
  lessons: [
    {
      title: 'Définition de l’Entreprise',
      content: doc(
        p(
          'L’Entreprise est un projet collectif structuré, conçu et réalisé par les routiers pour répondre à un besoin réel de la société. Elle constitue l’outil principal de formation par l’action à la Route.',
        ),
        p(
          'Au compagnonnage, le routier en assure la conduite ou la coordination. Le tableau synoptique lui consacre 8 mois (18 ans), 5 mois (19 ans) ou 3 mois (20 ans) ; elle est reconnue par un label de domaine d’action.',
        ),
        sapf('p. 3 à 6'),
      ),
    },
    {
      title: 'Identification d’un besoin réel',
      content: doc(
        p(
          'Toute Entreprise commence par l’analyse du besoin. Elle apprend au routier à analyser une situation et à identifier un besoin réel de la société.',
        ),
        p(
          'Le coordinateur questionne la pertinence du projet et veille à sa cohérence avec l’esprit de la Route.',
        ),
        reflect('Autour de toi, quel besoin concret pourrait justifier une Entreprise ?'),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Conception du projet',
      content: doc(
        p(
          'L’Entreprise apprend à concevoir et planifier un projet. Ses étapes sont claires : analyse du besoin, définition des objectifs, planification, réalisation, évaluation et bilan.',
        ),
        ol(
          'Analyse du besoin.',
          'Définition des objectifs.',
          'Planification.',
          'Réalisation.',
          'Évaluation.',
          'Bilan.',
        ),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Objectifs et planification',
      content: doc(
        p(
          'Après l’analyse du besoin viennent la définition des objectifs et la planification. Le domaine d’action choisi (voir le module « Domaines d’action de l’Entreprise ») oriente les objectifs.',
        ),
        reflect('Comment saurez-vous, à la fin, que l’objectif est atteint ?'),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Mobilisation des ressources',
      content: doc(
        p(
          'Le compagnonnage inclut l’implication dans des partenariats extérieurs. L’Entreprise mobilise l’équipe et, le cas échéant, des partenaires.',
        ),
        sapf('p. 4'),
      ),
    },
    {
      title: 'Réalisation',
      content: doc(
        p(
          'La réalisation met en jeu le travail en équipe et l’engagement concret au service des autres. Le coordinateur accompagne sans diriger.',
        ),
        quote('« Le scout obéit sans réplique et ne fait rien à moitié. » (loi scoute, article 7)'),
        sapf('p. 6'),
        base('p. 2'),
      ),
    },
    {
      title: 'Évaluation',
      content: doc(
        p(
          'L’Entreprise apprend à relire et évaluer son action. L’évaluation compare ce qui a été réalisé aux objectifs définis.',
        ),
        reflect('Qu’est-ce qui a fonctionné ? Qu’est-ce qui n’a pas fonctionné, et pourquoi ?'),
        sapf('p. 6'),
      ),
    },
    {
      title: 'Bilan et transmission',
      content: doc(
        p(
          'Le bilan clôt l’Entreprise. Le compagnonnage fait passer du faire au transmettre : le routier partage ce qu’il a appris et soutient les plus jeunes.',
        ),
        reflect('Que transmettrais-tu à une équipe qui commence sa première Entreprise ?'),
        conclude(
          'L’Entreprise répond à un besoin réel ; elle n’est pas une activité pour soi.',
          'Elle suit des étapes claires, de l’analyse au bilan.',
          'Elle se conclut par la transmission.',
        ),
        sapf('p. 4 et 6'),
      ),
    },
  ],
  notes: [
    ...commonNotes('Compagnonnage'),
    note(
      'A_COMPLETER',
      4,
      'Mobilisation des ressources (budget, matériel, financement, partenariats) : à peine évoquée par le manuel. À compléter d’après une source vérifiée.',
    ),
    note(
      'A_COMPLETER',
      3,
      'Outils de planification (calendrier, répartition des tâches) : non décrits par le manuel.',
    ),
  ],
};

/** Domaine d'action : texte du manuel et exemples éditoriaux clairement signalés. */
const domain = (
  title: string,
  description: string,
  programmes: string[],
  outcome: string,
  examples: string[],
  pages: string,
  extra: LessonBlock[] = [],
) => ({
  title,
  content: doc(
    p(description),
    h('Programmes OMMS associés'),
    ul(...programmes),
    p(outcome),
    h('Exemples de projets (proposition éditoriale)'),
    p('Ces exemples ne figurent pas dans le manuel : ce sont des pistes à adapter et à valider.'),
    ul(...examples),
    extra,
    sapf(pages),
  ),
});

const M10: SourceModule = {
  key: 'NT-ROUTE-M10',
  slug: 'route-m10-domaines-d-action-de-l-entreprise',
  title: 'Domaines d’action de l’Entreprise',
  summary:
    'Les dix domaines d’action du manuel, leurs programmes OMMS associés et des pistes de projets.',
  objectives: [
    'Présenter les dix domaines d’action de la branche Route.',
    'Relier une Entreprise aux programmes de l’OMMS.',
    'Choisir un domaine adapté à un besoin réel.',
  ],
  stageCode: 'COMPAGNONNAGE',
  theme: THEME,
  category: 'ETAPE',
  sourceDocument: SAPF_DOCUMENT,
  sourceSha256: SAPF_SHA256,
  sourcePages: 'p. 6 à 8',
  lessons: [
    domain(
      'Santé et sport',
      'Ce domaine vise la promotion d’un mode de vie sain, l’équilibre physique et mental, ainsi que la prévention des comportements à risque. Les entreprises peuvent porter sur la sensibilisation à la santé, l’organisation d’activités sportives éducatives ou l’accompagnement de populations vulnérables.',
      [
        'LifeLeaders : développement des compétences de vie et du bien-être personnel.',
        'Scouts for SDGs (ODD 3 – Bonne santé et bien-être).',
      ],
      'Le routier apprend à prendre soin de lui-même et à promouvoir la santé comme un enjeu communautaire.',
      [
        'Journée de sensibilisation à l’hygiène dans un quartier, avec un professionnel de santé.',
        'Tournoi sportif éducatif pour les jeunes d’une paroisse.',
      ],
      'p. 6',
    ),
    domain(
      'Développement social',
      'Ce domaine regroupe les actions de solidarité, d’inclusion sociale, de lutte contre la pauvreté et d’accompagnement des communautés défavorisées.',
      [
        'Messengers of Peace : promotion de la solidarité, de la cohésion sociale et du dialogue.',
        'Scouts for SDGs (ODD 1, 10, 11).',
      ],
      'Le routier découvre sa capacité à transformer concrètement son environnement social.',
      [
        'Collecte et distribution de fournitures scolaires avec une structure d’accueil.',
        'Soutien scolaire régulier pour des enfants d’un quartier.',
      ],
      'p. 6 et 7',
    ),
    domain(
      'Éducation à la paix',
      'Ce domaine concerne la promotion de la paix, du dialogue, de la citoyenneté et de la résolution non violente des conflits.',
      ['Dialogue for Peace.', 'Messengers of Peace.', 'Scouts of the World Award.'],
      'Le routier devient acteur du vivre-ensemble et apprend à gérer les conflits avec maturité.',
      [
        'Ateliers de dialogue entre jeunes de communautés différentes.',
        'Animation d’un débat citoyen dans un établissement scolaire.',
      ],
      'p. 7',
    ),
    domain(
      'Environnement',
      'Ce domaine vise la protection de la nature, la lutte contre le changement climatique et la sensibilisation aux comportements écoresponsables.',
      [
        'Plastic Tide Turners : lutte contre la pollution plastique.',
        'Scouts Go Solar : promotion des énergies renouvelables.',
        'Earth Tribe : mobilisation mondiale des scouts pour la planète.',
        'Scouts for SDGs (ODD 13, 14, 15).',
      ],
      'Le routier développe une conscience écologique active et responsable.',
      [
        'Opération de ramassage et de tri des déchets plastiques sur une plage ou dans un quartier.',
        'Plantation et entretien d’arbres avec une école.',
      ],
      'p. 7',
    ),
    domain(
      'Éducation sexuelle',
      'Ce domaine aborde l’éducation à l’affectivité, à la sexualité responsable, au respect du corps et à la prévention.',
      ['LifeLeaders.', 'Scouts for SDGs (ODD 3 et 5 – Santé et égalité des genres).'],
      'Le routier acquiert une vision responsable et respectueuse de la personne humaine.',
      [
        'Causerie de prévention animée avec des professionnels de santé, auprès de jeunes adultes.',
        'Campagne de sensibilisation au respect et à l’égalité entre filles et garçons.',
      ],
      'p. 7',
    ),
    domain(
      'Agro-pastorale',
      'Ce domaine concerne les actions liées à l’agriculture, à l’élevage, à la sécurité alimentaire et au développement rural.',
      [
        'Scouts for SDGs (ODD 2 – Faim zéro, ODD 12 – Consommation responsable).',
        'Projets Better World Framework liés au développement durable.',
      ],
      'Le routier comprend les enjeux de l’autonomie alimentaire et du développement local durable.',
      [
        'Création d’un jardin potager communautaire.',
        'Appui à un petit élevage au profit d’une œuvre sociale.',
      ],
      'p. 7 et 8',
    ),
    domain(
      'Vie et foi',
      'Ce domaine regroupe les actions spirituelles, pastorales et de témoignage de foi, vécues dans le respect des convictions de chacun.',
      [
        'Dialogue for Peace (dimension interreligieuse).',
        'Dimension spirituelle du Better World Framework.',
      ],
      'Le routier approfondit sa foi et apprend à la vivre comme source d’engagement et de service.',
      [
        'Service régulier auprès d’une paroisse (accueil, animation).',
        'Rencontre de dialogue interreligieux entre jeunes.',
      ],
      'p. 8',
    ),
    domain(
      'Art et culture',
      'Ce domaine vise la promotion de la créativité, de l’expression artistique et de la valorisation du patrimoine culturel.',
      [
        'Patrimonito : protection et valorisation du patrimoine culturel.',
        'Dialogue for Peace (dialogue interculturel).',
      ],
      'Le routier développe son identité culturelle et sa capacité à dialoguer avec les autres cultures.',
      [
        'Exposition sur le patrimoine d’une commune d’Abidjan.',
        'Atelier de contes et de chants traditionnels pour des enfants.',
      ],
      'p. 8',
    ),
    domain(
      'Éducation et protection de l’enfance',
      'Ce domaine concerne l’éducation, la prévention des abus, la protection des enfants et l’encadrement éducatif.',
      ['Safe from Harm : politique mondiale de protection de l’enfance.', 'Messengers of Peace.'],
      'Le routier devient un adulte responsable, conscient de son rôle protecteur et éducatif.',
      [
        'Animation d’activités éducatives dans un centre d’accueil, avec l’accord et l’encadrement de ses responsables.',
        'Sensibilisation des parents à la protection de l’enfance, avec une structure spécialisée.',
      ],
      'p. 8',
    ),
    domain(
      'Technologies de l’information et de la communication (TIC)',
      'Ce domaine regroupe les actions liées au numérique, à la communication et à l’usage responsable des technologies.',
      [
        'Scouts for SDGs (ODD 4 – Éducation de qualité).',
        'Initiatives numériques du Better World Framework.',
        'Programmes éducatifs type Scouts Go Digital (selon contextes nationaux).',
      ],
      'Le routier développe des compétences numériques utiles et apprend à utiliser la technologie au service du bien commun.',
      [
        'Initiation à l’informatique pour des personnes âgées ou des élèves.',
        'Atelier de sensibilisation à la sécurité en ligne et aux fausses informations.',
      ],
      'p. 8',
      conclude(
        'Dix domaines inscrivent l’Entreprise dans une dynamique locale et mondiale.',
        'Le domaine se choisit à partir d’un besoin réel, pas l’inverse.',
      ),
    ),
  ],
  notes: [
    ...commonNotes('Compagnonnage'),
    note(
      'A_VERIFIER',
      null,
      'Exemples de projets : propositions éditoriales absentes du manuel, signalées comme telles dans chaque leçon. À valider ou remplacer par des exemples de la communauté.',
    ),
    note(
      'A_VERIFIER',
      null,
      'Noms et périmètres des programmes OMMS repris du manuel : à confronter aux pages officielles de l’OMMS avant publication.',
    ),
    note(
      'A_COMPLETER',
      null,
      'Conclusion et choix d’un domaine : le manuel ne donne pas de critère de choix ni de modalité d’attribution du « label de domaine d’action ».',
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
        sapf('p. 9'),
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
      'A_VERIFIER',
      null,
      'Le Départ routier est distinct de la sortie de la branche au 21e anniversaire (règle de la communauté) : aucune étape n’est attribuée à la sortie.',
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
