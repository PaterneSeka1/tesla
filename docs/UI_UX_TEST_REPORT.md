# Rapport de tests — refonte UI/UX

Date : 2026-11-03 · Branche `feat/refonte-ui-ux-tesla` · Environnement : poste local (WSL2), Node.js 22.23.4, npm 10.9.9.

## 1. Environnement

- Base **`tesla_local`** créée dans le conteneur de développement `tesla-postgres` (`localhost:5433`), distincte de la base de développement `tesla`. Cible vérifiée avant chaque commande (hôte `localhost:5433`, nom `tesla_local`) ; `DATABASE_URL` passée par variable d'environnement, `.env` non modifié.
- `prisma migrate deploy` (22 migrations) puis `prisma db seed` : 4 étapes, programme 2026–2027 vide, 15 modules en brouillon, 26 comptes de démonstration fictifs (`*.demo@tesla.test`), 19 profils routiers.
- Données fictives ajoutées **par l'API** (contrôles d'autorisation inclus) : désignation plein / adjoint / assistant par l'administrateur, 3 équipes, 17 affectations, 15 activités (4 réalisées avec présences, 1 annulée, 1 reportée, 9 planifiées).
- `pedagogy:release` sur `tesla_local`, **sans** `--notes-verifiees` (déclaration réservée au responsable) : 3 modules et 3 questionnaires publiés.
- Aucune connexion à la production, aucun déploiement, aucun secret affiché.

## 2. Vérifications automatiques

| Commande | Référence (avant) | Après la refonte |
|---|---|---|
| `npm run lint` | réussi | réussi |
| `npm run typecheck` | réussi | réussi |
| `npm run test` — API | 207 tests réussis (25 fichiers) | 207 réussis |
| `npm run test` — web | 85 tests réussis (8 fichiers) | 93 réussis (9 fichiers) |
| `npm run format:check` | — | réussi |
| `npm run build` | non relancé | réussi (shared, API, web) |

Tests ajoutés : `lib/calendar.test.ts` (grille mensuelle du lundi au dimanche, changement d'année, mois finissant un dimanche, synthèse du programme, mois sans séance) et `lib/format.test.ts` (`formatMonth`, `formatBytes`). `lib/navigation.test.ts` (41 tests, rubriques D141 et règles d'accès) passe sans modification.

Les résultats « après » viennent de la dernière exécution, faite après tous les changements de code.

## 3. Vérifications visuelles (navigateur automatisé)

Chromium 1248 sans interface, piloté par Playwright (`playwright-core` 1.56, utilisé en lecture seule, rien installé dans le dépôt) ; connexion par le vrai formulaire, préférence « réduire les animations ». Pour chaque capture, la largeur de défilement du document a été mesurée.

| Écran | Compte | Largeurs | Débordement horizontal |
|---|---|---|---|
| Statistiques | plein | 360, 390, 768, 1440 | 0 px |
| Programme annuel | plein | 360, 390, 768, 1024, 1440 | 0 px |
| Activités (liste) | encadrement, plein | 360, 390, 768, 1440 | 0 px |
| Détail d'activité | encadrement | 390, 1440 | 0 px |
| Progression, mes activités | routier | 390, 1440 | 0 px |
| Accueil | plein, encadrement, routier, administrateur | 1440 (admin aussi 390) | 0 px |
| Bibliothèque, module, leçon | routier | 390, 1440 | 0 px |
| Cet appareil (non préparé) | routier | 390, 1440 | 0 px |
| Routiers, copies, mon profil | plein | 360, 768 | 0 px |
| Comptes | administrateur | 390, 1440 | 0 px |

Défauts trouvés à l'écran puis corrigés : libellés d'axe coupés ou repliés (« Compagnonnage », « Équipe Faraday »), légende triée par ordre alphabétique, « Mois sans séance : 0 » affiché sans période de programme, titres de séance trop tronqués sur mobile, colonnes du détail par équipe trop serrées à 360 px.

Captures retenues : [docs/QUALITY/ui-ux-2026-11-03/](QUALITY/ui-ux-2026-11-03/). **Pas de capture « avant » pour les écrans refondus** : l'outil de capture a été mis en place après les premières modifications des statistiques et du programme. Les captures « avant » existent seulement pour « Cet appareil » et la bibliothèque, qui n'ont pas changé de présentation.

Messages de la console en développement : avertissements Next.js « Could not validate that a segment in your UI has instant navigation » sur toutes les routes, et un 401 attendu sur `/auth/me` avant la connexion. Ils sont **antérieurs à la refonte** (non liés aux fichiers modifiés).

## 4. Permissions et règles métier

- `ACCESS_RULES` et la matrice `packages/shared/src/permissions.ts` ne sont pas modifiées ; seuls l'ordre et les intertitres de la rubrique « Routiers » changent (`navigation.test.ts` réussi).
- Les menus capturés correspondent aux permissions : routier (Accueil, Cours, Évaluations, Mon parcours, Mon profil), encadrement (avec Routiers), plein (avec Décisions et Administration), administrateur (Accueil, Mon profil, Administration).
- Import du programme : prévisualisation obligatoire et confirmation inchangées (même appel API, bouton désactivé en cas d'erreur).
- Aucune séance générée : le calendrier et la synthèse ne lisent que les activités existantes.
- Statistiques : données de `GET /statistics` seulement, aucun classement, aucune donnée médicale.

## 5. Non exécuté

- **Parcours fonctionnels complets en navigateur** : la connexion et la navigation ont été exercées, mais pas, dans un navigateur, l'enregistrement d'un statut, de présences, d'une activité, d'un import de programme, ni la passation d'une évaluation. Ces écritures reposent sur des fonctions API inchangées ; seule la présentation a changé.
- **Hors ligne** : appareil non préparé ni déverrouillé dans le navigateur automatisé (phrase locale, coffre IndexedDB) ; « Cet appareil » préparé et la synchronisation n'ont pas été testés visuellement. Les tests unitaires hors ligne existants passent.
- Lecteur d'écran réel, contraste mesuré à l'outil, navigation au clavier dans le navigateur.
- Tests d'intégration de l'API : seul `test/medical-records.int-spec.ts` a été relancé (12 tests réussis sur `tesla_test`, après le changement du PDF) ; les autres suites ne sont pas concernées et n'ont pas été relancées.
- Fiche médicale : non modifiée ; non testée visuellement.

## 6. Fiche médicale (D170)

Base `tesla_local`, données fictives uniquement (marqueur « ArachideFictiveTest »). Clé `MEDICAL_DATA_KEY` jetable, générée pour le seul processus de développement (ni `.env`, ni disque). Parcours automatisé dans Chromium (Playwright) :

| Vérification | Résultat |
|---|---|
| Création (téléphone, contact, allergie), notification | réussi |
| Consultation après rechargement ; champ vide replié, champ renseigné ouvert ; focus sur le champ ouvert | réussi |
| Modification (ajout d'une précaution) | réussi |
| PDF du titulaire : 200, `application/pdf`, `Cache-Control: no-store` ; lecture JSON `no-store` | réussi |
| Suppression par dialogue ; fiche nulle ; PDF en 404 ensuite | réussi |
| Aucune donnée médicale dans `localStorage`, `sessionStorage`, Cache Storage, IndexedDB | réussi |
| Administrateur : API 403, aucune fiche affichée | réussi |
| Aucune route par identifiant (`/medical-records`, `/users/x/medical-record`, `/scouts/x/medical-record`) : 404 | réussi |
| Plein : seulement sa propre fiche (aucune trace de celle du routier) | réussi |
| Journaux API, web et PostgreSQL : aucune occurrence des données fictives | réussi |
| Audit : `medical.created`, `updated`, `exported`, `deleted` avec la seule révision | réussi |
| Débordement horizontal : 0 px à 360 px (chargement direct, champs ouverts, pendant la notification) et à 1440 px | réussi |

Une mesure à 9 px a été relevée une seule fois, après avoir réduit la même page de 1440 à 360 px ; elle ne se reproduit pas au chargement direct à 360 px. PDF d'essai (nom de contact de 100 caractères, deux contacts) contrôlé visuellement : une page A4, aucun chevauchement. Tests ajoutés : répartition des champs dans les quatre sections (`medical.spec.ts`) ; test PDF existant inchangé et réussi.

Intégration : `test/medical-records.int-spec.ts` (création, isolement, 403 administrateur, conflits, chiffré en base, audit sans contenu, PDF A4 `no-store`, suppression, 503 sans clé) — 12 tests réussis sur `tesla_test`.

Non exécuté : impression réelle sur papier.
