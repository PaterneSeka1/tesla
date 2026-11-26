# Référentiel scout

Décisions : D220 (référentiel), D221 (enregistrements et paroles synchronisées), D222 (copies audio hors ligne). Suivi du chantier : [TESLA_SCOUT_REFERENCE_PROGRESS.md](../TESLA_SCOUT_REFERENCE_PROGRESS.md).

## Principe

Le référentiel rassemble ce qu'un routier doit retrouver vite, en réunion comme au camp : prières, cérémonies, chants, récits, textes de référence.

- **Une ressource est un module** « texte fondamental » (D125). Rédaction, versions, soumission, publication par le responsable plein (D188), historique, impression, PDF et hors ligne sont ceux des modules. Aucun circuit parallèle.
- **Le référentiel range** ces modules dans des **rubriques** dynamiques (`reference_categories`). Un rangement (`reference_entries`) désigne un module entier ou une seule de ses leçons (identité stable `lesson_key`, valable de version en version) : la loi scoute du module M02 est ainsi accessible directement, sans copie.
- **Visibilité** : un apprenant ne voit que les rubriques non retirées qui contiennent au moins une ressource publiée. Brouillons, rubriques vides et retirées restent visibles de l'encadrement seulement (`/encadrement/referentiel`).
- **Aucune lecture enregistrée** : ni XP, ni statistique de consultation. Lire, préparer ou jouer une cérémonie n'enregistre jamais un engagement, un flot, une étoile, un acquis ni une étape. La cérémonie du départ routier n'est pas la sortie administrative de la branche (calculée selon l'âge).

## Écrans

| Écran | Chemin | Accès |
| --- | --- | --- |
| Référentiel (rubriques, recherche) | `/referentiel` | `module.read` (routiers, adultes, encadrement) |
| Ressource, fiche, lecture intégrale | `/referentiel/:id`, `?fiche=…`, `?integral=1` | `module.read` |
| Rubriques et rangements | `/encadrement/referentiel` | `module.write` ; rubriques : `reference.manage` (plein) |

Menu : rubrique « Cours » existante (aucune nouvelle destination dans la barre inférieure) ; lien discret depuis la bibliothèque.

## Présentation selon le contenu

- **Cérémonie** (texte dialogué, au moins deux répliques) : intervenants en couleur, paroles en clair, indications scéniques en italique encadrées, notes « NB ». Modes :
  - **Mon rôle** : rôles tirés du texte (« Le CC » → « CC » ; « Routiers en rectangle » rattaché à « Routiers ») ; répliques mises en évidence, réplique précédente signalée « Avant votre réplique ». Sans effet sur les droits du compte.
  - **Préparation** : les phrases réellement écrites dans la rubrique « Préparation », cochables sur l'appareil (liste personnelle, jamais une validation).
  - **Mode cérémonie** : plein écran sobre, une étape à la fois avec la précédente et la suivante en rappel, taille réglable, flèches du clavier, « Ma réplique », reprise de la dernière position, écran maintenu allumé (Screen Wake Lock) si le navigateur le permet et si la case reste cochée.
- **Prière** (rubrique d'ambiance « Prière ») : texte centré et calme ; « Apprendre par cœur » facultatif : révéler ligne à ligne, compléter (mot masqué déterministe), remettre en ordre. Aucun chronomètre, classement, score ni XP.
- **Chant, récit, texte** : rendu habituel des leçons ; un enregistrement affiche son lecteur.
- Taille du texte réglable partout (mémorisée sur l'appareil).

Conventions de rédaction d'une cérémonie (lues par `parseCeremony`, `@tesla/shared`) : intervenant **en gras** suivi de « : » en début de paragraphe ; les paragraphes et listes qui suivent prolongent la réplique ; indication scénique en citation ; note « **NB :** » ; « Référence : … » ; titres « Préparation », « Déroulé et paroles ».

## Enregistrements et paroles synchronisées (D221)

Bloc de leçon `audio` : fichier vérifié du module (MP3, M4A, OGG, WAV, 20 Mo), titre, auteur ou source, droits, téléchargement autorisé, phrases (texte, début, fin facultative, couplet ou refrain) et enregistrement de référence des repères (`syncedSrc`).

Lecteur : lecture, pause, ±10 s, barre de progression, durées, vitesse 0,75–1,25, paroles **intégrales** ou **synchronisées** (phrase en cours mise en évidence et centrée, voisines visibles, toucher une phrase y déplace la lecture). Un défilement manuel suspend le suivi 8 s, bouton « Revenir à la phrase en cours ». Phrase en cours calculée sur la position réelle de l'audio à chaque image : pause, déplacement et vitesse restent synchronisés. **Chant collectif** : plein écran contrasté, grands caractères, contrôles essentiels, écran allumé ; utilisable sans audio (paroles intégrales). Media Session (écran verrouillé, écouteurs) quand le navigateur le propose. Aucune pochette fictive, aucune statistique d'écoute.

Repères : valables pour l'enregistrement exact. Remplacer le fichier efface les repères (jamais réutilisés) ; les paroles restent en texte intégral jusqu'à une nouvelle validation. Une chronologie incohérente n'est jamais enregistrée comme synchronisée (schéma partagé, revérifié par l'API).

Droits : « non vérifiés » par défaut ; **soumission refusée** (`AUDIO_RIGHTS_UNKNOWN`) tant qu'un enregistrement n'est pas déclaré « diffusion autorisée ».

## Hors ligne

- Textes : le catalogue et le contenu des ressources passent par le coffre chiffré comme toute lecture ; « Préparer l'appareil » charge le référentiel et ses pages ; « Télécharger » (bouton des modules) prépare une ressource.
- Audio (D222) : bouton « Télécharger pour écouter hors ligne » sur chaque enregistrement autorisé ; copie dans une base IndexedDB dédiée, rattachée au titulaire du coffre, supprimable ; lecture locale prioritaire (aucune URL signée nécessaire). Paroles et repères viennent du même texte publié.

## Guide de l'encadrement : ajouter une ressource sans développeur

1. **Rubrique** (responsable plein) : `Cours › Rubriques du référentiel › Nouvelle rubrique` — titre (ex. « Chants de veillée »), présentation (Cérémonie, Prière, Chant, Récit, Texte), icône facultative. Elle reste invisible des routiers tant qu'elle est vide.
2. **Ressource** : dans la rubrique, « Nouvelle ressource » → titre → l'éditeur s'ouvre (module « texte fondamental » déjà rangé). Ou « Ranger un module existant » (module entier ou une seule partie).
3. **Texte** : saisir ou coller le texte (charte, légende, prière…). Une partie par leçon si le texte est long (articles d'une charte, chapitres d'un récit).
4. **Chant ou récit audio** : barre d'outils › « Bloc pédagogique » › « Chant ou récit audio », choisir le fichier. Puis « Atelier » :
   1. Enregistrement : titre, auteur ou source, **diffusion autorisée**, téléchargement autorisé ou non ;
   2. Paroles : coller (une phrase par ligne ; une ligne « Refrain » marque les lignes suivantes) ou importer un fichier LRC, WebVTT ou SRT ; dupliquer un refrain chanté plusieurs fois ;
   3. Synchroniser : lancer l'écoute (vitesse réduite possible), toucher « Marquer » au début de chaque phrase ; corriger un repère à la main, « Écouter depuis ce repère », « Effacer » ; puis **Valider la synchronisation** ;
   4. Aperçu, puis « Enregistrer dans la leçon ».
5. **Associer** un chant à une cérémonie : dans le module de la cérémonie, « Textes cités » → le chant. Le lecteur le propose sous « À retrouver aussi ».
6. **Soumettre** : la ressource apparaît dans le référentiel dès sa publication par le responsable plein.

## API

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| GET | `/reference[?q=]` | Référentiel visible, recherche (titre, rubrique, texte, paroles ; accents ignorés) |
| GET | `/reference/manage` | Gestion (rubriques vides et retirées, état des rangements) |
| POST / PATCH | `/reference/categories[/:id]` | Créer, renommer, retirer, rétablir (plein) |
| POST | `/reference/categories/order`, `/reference/categories/:id/order` | Ordonner (plein) |
| POST / DELETE | `/reference/entries[/:id]` | Ranger, retirer un rangement (rédacteur du module) |

Contenu : routes existantes des modules (`/modules/:slug/print`, `/modules/:slug`). Fichiers : relais existant `/module-files/:id` (lisible si une version publiée le cite). Audit : `reference.category_created|updated`, `reference.entry_added|removed`, `reference.*_reordered`.

## Limites connues

- Lecture en arrière-plan et commandes système : dépendent du navigateur ; iOS interrompt souvent l'audio d'une PWA écran verrouillé. Non testé sur téléphones réels.
- Stockage R2 réel non testé ; lecture et téléchargement audio exigent la règle CORS `GET` du compartiment.
- Favoris : non réalisés (le chantier immersif prépare un système commun ; point d'intégration).
- Les textes du référentiel restent dans la banque d'entraînement dérivée et donnent l'XP de lecture **lorsqu'ils sont lus depuis la bibliothèque** (comportement existant des modules) ; exclusion à décider lors de l'intégration avec le chantier immersif.
