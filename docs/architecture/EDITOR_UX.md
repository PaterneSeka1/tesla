# Éditeur pédagogique — organisation et fonctionnement (refonte lot 1, D178–D179)

## 1. Organisation

`/encadrement/modules/:id/modifier` (`module-editor.tsx`) est organisé en **sections libres** (onglets, `?section=`), sans assistant imposé :

| Section | Contenu | Composants |
| --- | --- | --- |
| 1. Présentation | Titre, description, étape recommandée, objectifs ; « Informations complémentaires » repliées (catégorie, caractère obligatoire, source officielle, thème, durée, prérequis) ; textes fondamentaux cités et collaborateurs en sections repliables | `ModuleMetadataForm`, `TextsPanel`, `CollaboratorsPanel` |
| 2. Contenu | Espace de rédaction des leçons (deux zones) ; « Ressources et documents » repliable | `LessonsPanel`, `LessonEditor`, `ResourcesPanel` |
| 3. Vérification | Points bloquants, conseils non bloquants, ordre des leçons, accès direct à l'élément (« Corriger »), lien vers l'aperçu | `lib/module-readiness.ts` |
| 4. Soumission | Récapitulatif, conséquences (« Ce qui se passe ensuite »), envoi pour validation | `CommentDialog` → `submitModule` |
| Historique | Événements et versions (inchangé) | `ModuleHistory` |

Un module sans leçon s'ouvre sur « Présentation », sinon sur « Contenu ». L'action principale de l'en-tête dépend de la situation et des permissions renvoyées par l'API : « Reprendre la rédaction » (`canResume`), « Nouvelle version » (`canCreateVersion`) ou « Vérifier et envoyer » (`canSubmit`). Les actions secondaires (dupliquer) sont dans le menu « … ». Le workflow (`BROUILLON` → `SOUMIS` → …), les triggers et les contrôles serveur sont inchangés : l'interface n'expose que les actions autorisées.

Retours du responsable : en `A_CORRIGER` ou `REFUSE`, le motif, la version, l'auteur, la date et l'action à faire sont en tête de page ; après « Reprendre la rédaction », le motif reste affiché (« Corrections à apporter ») tant que la version n'est pas renvoyée.

## 2. Espace de rédaction des leçons

- **Ordinateur (≥ 1024 px)** : liste ordonnée des leçons à gauche (collante, défilement propre), zone de rédaction à droite. La leçon ouverte est dans l'adresse (`?lecon=`).
- **Mobile** : la liste devient un panneau repliable au-dessus de la rédaction (« Leçon 2 sur 5 · … »). Aucun défilement imbriqué ; grille bornée (`minmax(0,1fr)`) pour éviter tout débordement.
- Ajout (la nouvelle leçon s'ouvre), renommage (champ titre, enregistré automatiquement), suppression confirmée (une seule confirmation), réorganisation par boutons ou **Alt + flèche haut/bas** sur la leçon sélectionnée.
- Pastille rouge sur une leçon dont une modification n'est pas encore confirmée par le serveur.

## 3. Enregistrement automatique (`use-lesson-autosave.ts`, D179)

1. Chaque saisie (titre, durée, contenu) est copiée immédiatement dans un **brouillon local** (`lib/lesson-drafts.ts`, `localStorage`, clé par leçon, révision de référence incluse).
2. Après **1,5 s d'inactivité**, la leçon est envoyée (`PATCH /editor/lessons/:id` avec la révision de référence). Jamais une requête par frappe ; **un seul envoi à la fois** (une saisie pendant l'envoi déclenche un envoi suivant).
3. Confirmation du serveur → révision + 1, brouillon retiré (sauf saisie plus récente), « Enregistré à hh:mm ».

| État | Affichage | Comportement |
| --- | --- | --- |
| `dirty` | Modifications en cours… | Envoi après le délai |
| `saving` | Enregistrement… | — |
| `saved` | Enregistré à hh:mm | — |
| `offline` | Hors connexion — conservé sur cet appareil | Envoi au retour du réseau (`online`) et toutes les 20 s |
| `error` | Échec de l'enregistrement — conservé sur cet appareil | « Réessayer maintenant », nouvelle tentative toutes les 20 s |
| `invalid` | À corriger avant enregistrement | Message de validation (schéma partagé), aucun envoi |
| `conflict` | Conflit : modifiée par une autre personne | Aucun envoi ; « Garder ma version » (confirmation) ou « Reprendre la version enregistrée » |

- **Changement de leçon ou de page** : la saisie en attente est envoyée immédiatement ; le brouillon local reste le filet de sécurité. `beforeunload` avertit tant qu'une saisie n'est pas confirmée.
- **Reprise** : à l'ouverture d'une leçon, un brouillon local sur la révision actuelle est repris et envoyé (« Modifications non envoyées retrouvées sur cet appareil ») ; sur une révision dépassée et différente du serveur → conflit, décision explicite. Un brouillon identique au serveur est simplement retiré.
- **Concurrence** : la révision optimiste et `EDIT_CONFLICT` sont conservés ; une version distante n'est **jamais** remplacée silencieusement.
- Les brouillons contiennent du contenu pédagogique (aucune donnée personnelle) ; ils restent sur l'appareil tant qu'ils ne sont pas confirmés, y compris après déconnexion. Stockage indisponible ou plein : message, la saisie reste en mémoire.
- Hors connexion, une leçon ne peut pas être enregistrée sur le serveur (écriture non différable, inchangé) : elle reste dans le brouillon local jusqu'au retour du réseau.

## 4. Éditeur de texte (`LessonEditor`, Tiptap)

Titres, sous-titres, gras, italique, souligné, barré, listes, citation, lien, image, séparateur, défaire/refaire, états actifs (`aria-pressed`), raccourcis indiqués dans les infobulles (Ctrl+B/I/U/Z, Ctrl+Maj+Z). Sur petit écran, souligné, barré, liste numérotée, citation et séparateur passent dans « Plus d'options de mise en forme ». Après un menu, le focus revient dans le texte.

## 5. Blocs pédagogiques (D178)

Menu « Bloc pédagogique » : **Objectifs**, **À retenir**, **Exemple**, **Activité pratique**, **Question de réflexion**, **Référence** (`PEDAGOGICAL_BLOCKS`, `@tesla/shared`).

- Un bloc = un **titre de niveau 3 reconnu** suivi de son contenu jusqu'au titre suivant ; « Référence » = une ligne « Référence : … » regroupée en pied de leçon. **Aucun nœud nouveau** : schéma `lessonDocumentSchema`, API, base, PDF, paquet hors ligne et empreintes inchangés ; aucun HTML stocké.
- Rendu web (`lesson-structure.ts`) : encadrés (mêmes styles que les rubriques du catalogue) ; PDF : titre + contenu lisibles ; mobile et hors ligne : même rendu.
- Limite : la fin d'un bloc est implicite (titre suivant). Un nœud dédié serait plus explicite mais imposerait une évolution du schéma, du PDF et des paquets hors ligne.

## 6. Images

- **Depuis l'appareil** (nouveau) : PNG, JPEG, WebP, GIF ; **3 Mo au plus** (pour rester téléchargeable hors ligne, `MAX_ASSET_BYTES`) ; aperçu local ; **description obligatoire** ; envoi par le circuit de stockage existant (`uploadModuleFile` : autorisation, envoi direct signé, vérification serveur du type réel et de l'empreinte, D143). L'image est insérée sous son **chemin interne** `/api/v1/module-files/:id` (jamais d'URL signée).
- **Adresse web** : https uniquement (inchangé).
- Schéma partagé : `isSafeImageSrc` accepte https ou le chemin interne strict (UUID, sans paramètre ni segment supplémentaire) ; testé dans `module-contracts.spec.ts`.
- API : à l'enregistrement d'une leçon, toute image interne **nouvelle** doit être une image `VALIDE` **du même module** (sinon `422 FILE_NOT_AVAILABLE`) ; une image déjà présente (nouvelle version, duplication) est conservée. Lecture (`GET /module-files/:id`) : accordée si une leçon de la **version publiée** la cite (verrou de rattrapage D177 appliqué), sinon aux rédacteurs des modules qui la citent. Test : `module-files.int-spec.ts`.
- Affichage : `resolveImageSrc` rattache le chemin à `NEXT_PUBLIC_API_URL` (relais même origine en production, API distincte en développement). PDF : « [Illustration : description] » sans le chemin. Hors ligne : l'image est téléchargée avec la session (`credentials: 'include'`) puis chiffrée dans le coffre comme les autres images.
- **À vérifier en préproduction** : la redirection vers R2 suivie par `fetch` (téléchargement hors ligne) exige que la politique CORS du compartiment autorise `GET` depuis l'origine du web. L'envoi réel vers R2 n'est pas testable localement (stockage simulé).

## 7. Aperçu

`/encadrement/modules/:id/apercu` : rendu exact destiné au routier (`ModuleVersionView`), bascule **Ordinateur / Téléphone (360 px)**, impression. Règles d'accès inchangées.

## 8. Tests

- Unitaires : `module-readiness.test.ts`, `lesson-drafts.test.ts` (web) ; `module-contracts.spec.ts` (images).
- Intégration : `module-files.int-spec.ts` (image du module seulement, lecture après publication).
- Navigateur : `apps/web/test/editeur-pedagogique.browser.mjs` (14 contrôles : création, leçons, enregistrement automatique, bloc, changement de leçon, coupure réseau, reprise de brouillon, conflit, réorganisation clavier, vérification, contrôle d'image, aperçu téléphone, soumission, 360 px).
