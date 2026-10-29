# Modules pédagogiques — fonctionnalités livrées

Phase 2 (2026-10-29). Ce document décrit ce qui est **réellement développé**. Workflow détaillé : [WORKFLOW_PUBLICATION.md](WORKFLOW_PUBLICATION.md) ; contrats : [API.md](../API.md#modules-pédagogiques) ; règles : [BUSINESS_RULES.md](../BUSINESS_RULES.md) (RM-019 à RM-027) ; choix : [DECISIONS.md](../DECISIONS.md) (D44 à D56).

Légende : ✅ implémentée et testée · 🟡 partielle · ⬜ non développée · ⛔ bloquée (arbitrage attendu).

> Aucun contenu pédagogique n'est fourni par l'application : les thèmes cités dans la mission (histoire du scoutisme, loi scoute, etc.) sont des exemples. Les modules sont rédigés par les chefs et publiés uniquement par le responsable. Aucune génération par intelligence artificielle.

## Modèle

| Élément | Rôle |
| --- | --- |
| Module (`PedagogicalModule`) | Identité stable : code interne `MOD-001` (numéro séquentiel), slug d'URL fixé à la création, auteur, pointeur vers **la** version publiée courante |
| Version (`ModuleVersion`) | Contenu éditorial : titre, description, objectifs, prérequis, durée, étape recommandée, thème, état, auteur, dates de soumission/approbation/publication, note de soumission |
| Leçon (`ModuleLesson`) | Leçon ordonnée d'une version : titre, durée, contenu structuré (JSON), compteur de révision |
| Ressource (`ModuleResource`) | Image, document, vidéo externe ou lien, rattaché au module ou à une leçon ; **URL externe uniquement** |
| Collaborateur (`ModuleCollaborator`) | Chef invité ; retrait daté, jamais supprimé |
| Historique (`ModuleVersionEvent`) | Création, soumission, reprise, décisions ; ajout seul |

L'étape et le thème sont portés par la **version** (et non par le module) : leur modification passe donc, comme le reste du contenu, par l'approbation du responsable (D45).

## Rédaction — espace chef

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Tableau de bord `/chef` | ✅ | Compteurs réels (brouillons, en attente, à corriger, publiés), activité éditoriale récente, bouton « Nouveau module ». |
| Liste `/chef/modules` | ✅ | Modules dont le chef est auteur ou collaborateur (tous pour le responsable) ; recherche par titre, filtre par état, pagination. |
| Création `/chef/modules/nouveau` | ✅ | Titre, description, étape recommandée, thème, durée, objectifs (un par ligne), prérequis → version 1 en brouillon. |
| Édition `/chef/modules/[id]/modifier` | ✅ | Informations, leçons, ressources, collaborateurs, historique ; actions selon l'état (soumettre, reprendre, nouvelle version). |
| Leçons : ajout, titre, durée, contenu, suppression, ordre | ✅ | Une leçon ouverte à la fois ; boutons monter/descendre ; enregistrement explicite par leçon ; alerte avant de quitter la page avec des modifications non enregistrées. |
| Éditeur de contenu | ✅ | Tiptap : titres et sous-titres, paragraphes, gras, italique, souligné, barré, listes à puces et numérotées, citations, séparateur, liens, images (adresse https), annuler/rétablir. Barre d'outils accessible (`role="toolbar"`, `aria-pressed`). |
| Ressources | ✅ | Type, titre, adresse, description, rattachement (module ou leçon). Vidéos : YouTube ou Vimeo uniquement (liste provisoire). |
| Collaboration | ✅ | L'auteur (ou le responsable) invite un chef actif ou le retire ; le collaborateur rédige et soumet. Un chef non invité ne voit pas le module (404). |
| Aperçu `/chef/modules/[id]/apercu` | ✅ | Rendu identique à la bibliothèque ; `?version=` pour une version antérieure ; impression. |
| Soumissions `/chef/soumissions` | ✅ | Versions soumises, à corriger, approuvées, refusées ; retours (motifs) du responsable. |
| Sauvegarde automatique | ⬜ | Volontairement non développée : enregistrement explicite + détection des conflits (D48). |
| Téléversement de fichiers | ⬜ | Aucun stockage de fichiers ; ressources par URL (D51). |
| Génération de contenu par IA | ⛔ | Interdite par la gouvernance du projet. |

## Contenu enrichi et sécurité

- Le contenu d'une leçon est un document **JSON ProseMirror** validé par une **liste blanche** Zod (`lessonDocumentSchema`, `@tesla/shared`) côté web et côté API : nœuds `paragraph`, `heading` (niveaux 2 et 3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `image` ; marques `bold`, `italic`, `underline`, `strike`, `link`.
- Tout nœud inconnu (ex. `html`, bloc de code) est refusé (`400 VALIDATION_ERROR`) ; tout attribut non prévu (ex. `onerror`) est **retiré** avant stockage.
- Liens : `http:`, `https:`, `mailto:` uniquement (jamais `javascript:` ni `data:`). Images : `https:` uniquement (pas de base64).
- Profondeur d'imbrication ≤ 8, taille sérialisée ≤ 200 000 caractères.
- Le rendu (`LessonContent`) construit des éléments React à partir du JSON : aucun `dangerouslySetInnerHTML`, adresses revérifiées, liens ouverts avec `rel="noopener noreferrer nofollow"`, images en `referrerPolicy="no-referrer"`.

## Bibliothèque — tous les utilisateurs connectés

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Liste `/modules` | ✅ | Cartes des modules publiés ; recherche (titre, description, thème) ; filtres par étape et par thème ; pagination ; badge « Recommandé pour votre étape » pour un routier dont le profil a une étape. |
| Consultation libre | ✅ | **Aucun blocage par la progression** : un routier lit les modules de toutes les étapes. Seules les futures évaluations seront contrôlées. |
| Détail `/modules/[slug]` | ✅ | Étape recommandée, thème, durée, version, date de publication, objectifs, prérequis, leçons, ressources. |
| Lecteur `/modules/[slug]/lecons/[id]` | ✅ | Une leçon à la fois, barre de position, leçon précédente / suivante, ressources de la leçon. |
| Version imprimable `/modules/[slug]/imprimer` | ✅ | A4 via l'impression du navigateur (`@media print`) : identité de la communauté, code et version, titre, objectifs, contenu, illustrations, références (adresses imprimées) ; une leçon par page ; aucun corrigé. |
| Brouillons, soumissions, versions non publiées | ✅ | Jamais renvoyés par `/modules` (404). |
| Progression de lecture | ⬜ | Non modélisée (facultative, D54). |
| Lecture hors ligne | ⬜ | Phase 3 (IndexedDB) ; aucun contenu n'est mis en cache par le service worker. |
| PDF généré par le serveur | ⬜ | Phase 4 bis ; l'impression navigateur couvre le besoin actuel. |

## Vérifications effectuées (2026-10-29)

- Tests unitaires : contenu dangereux (liens `javascript:`, images `data:`/`http:`, nœuds inconnus, attributs retirés, imbrication), transitions, ressources vidéo, slugs, synchronisation des enums, permissions.
- 11 tests d'intégration HTTP sur PostgreSQL (`test/modules.int-spec.ts`) : rédaction, collaboration, refus hors périmètre, contenus invalides, concurrence, workflow complet, nouvelle version, triggers, bibliothèque, recherche et filtres.
- Recette Chromium (desktop 1366 px, mobile 390 px) sur une base jetable avec des comptes fictifs : les 15 critères de réussite de la phase (voir [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)).
