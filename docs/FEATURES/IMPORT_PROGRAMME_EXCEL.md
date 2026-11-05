# Import Excel du programme annuel et suivi prévu / réalisé

Décision : [D172](../DECISIONS.md). Guide pour les chefs : [GUIDE_IMPORT_PROGRAMME_EXCEL.md](../GUIDE_IMPORT_PROGRAMME_EXCEL.md).

Le classeur Excel est la **source officielle de planification** ; Tesla est la **source de vérité de l'exécution** (statut, date effective, présences, compte rendu). Un import ne réécrit jamais l'exécution.

## 1. Chaîne de traitement

```
Fichier .xlsx ─► lecteur XLSX (API) ─► tableau ─┐
Tableau Markdown ─► markdownToProgrammeTable ───┴─► correspondance des colonnes ─► normalisation
   ─► validation ─► rapprochement avec la base ─► prévisualisation (aucune écriture, empreinte)
   ─► confirmation : verrou, nouvelle analyse, contrôle de l'empreinte ─► transaction ─► historique
```

| Étape | Fichier |
|---|---|
| Lecture ZIP/XML bornée | `apps/api/src/modules/programmes/xlsx-reader.ts` |
| Champs, variantes d'en-têtes, dates, statuts, normalisation, Markdown | `packages/shared/src/programme-import.ts` (fonctions pures) |
| Rapprochement, protection, différences, empreinte, transaction, historique | `apps/api/src/modules/programmes/programme-import.service.ts` |
| Écran d'import | `apps/web/src/components/activities/programme-import.tsx` |
| Fiche de séance | `apps/web/src/components/activities/activity-detail.tsx` |

Le Markdown et l'Excel partagent la normalisation et tout le service (une seule architecture). Seule différence : une colonne Markdown inconnue reste un avertissement (comportement historique), une colonne Excel inconnue non vide bloque tant qu'elle n'est pas associée ou explicitement ignorée.

## 2. Lecture du classeur (sécurité)

Aucune dépendance ajoutée : `.xlsx` lu par un lecteur interne (répertoire ZIP + `zlib.inflateRawSync` avec `maxOutputLength`, XML analysé sans DTD). Pas de `.xls` : aucune bibliothèque maintenue et sûre ne le lit sans dépendances lourdes (SheetJS publié sur npm est figé en 0.18.5 avec des vulnérabilités connues) ; l'utilisateur enregistre le fichier en `.xlsx`.

| Contrôle | Valeur |
|---|---|
| Taille du fichier | 2 Mo (`PROGRAMME_XLSX_MAX_BYTES`), corps JSON 3 Mo **sur les deux routes Excel uniquement** (100 ko ailleurs) |
| Type réel | signature ZIP, `[Content_Types].xml` et `xl/workbook.xml` exigés ; `.xls`/classeur chiffré (OLE) refusés |
| Archive | 500 entrées, 8 Mo décompressés par partie, 24 Mo au total (bombe de décompression refusée), ZIP64 refusé, entrée chiffrée refusée |
| Classeur | 20 feuilles, 2 000 lignes non vides, 100 colonnes, 20 000 caractères par cellule, 600 000 nœuds XML |
| Macros | `xl/vbaProject.bin` → refus ; aucune macro n'est jamais exécutée |
| Formules | jamais exécutées : dernière valeur calculée par Excel (cache) ; formule sans cache → cellule vide signalée |
| Cellules en erreur | `#N/A`, `#REF!`… lues vides et signalées |
| Conservation | le fichier n'est jamais écrit sur disque ni en base : nom, empreinte SHA-256 et bilan seulement |

Erreurs affichées sans détail interne (`IMPORT_FILE_INVALID`).

## 3. Colonnes reconnues

Détection par libellé (accents, casse, espaces et ponctuation ignorés, contenu entre parenthèses retiré, pluriel simple toléré) ; **correspondance exacte uniquement**, jamais approchée. La ligne d'en-tête est la première des 50 premières lignes contenant Date et Intitulé (bandeaux et titres fusionnés au-dessus ignorés) ; elle peut être imposée.

| Champ | Variantes reconnues (exemples) | Enregistré dans |
|---|---|---|
| Date (obligatoire) | Date, Date du samedi, Date de la séance | `activities.planned_on` |
| Intitulé (obligatoire) | Temps commun / objectif, Activité, Séance, Titre | `title` |
| Axe | Axe du mois, Thème, Axe pédagogique | `theme` |
| Contenu par catégorie | libellé ou code d'une catégorie (Novices Routiers, Novices…) | `activity_categories.planned_content` |
| Format | Format, Format prévu, Modalité | `planned_format` |
| Responsable prévu | Responsable, Animateur | `leader_label` (texte libre, jamais rattaché à un compte) |
| Statut source | Statut, État | `source_status` (information, sans effet) |
| Effectif source | Présents (facultatif), Effectif | `source_attendance_count` (jamais converti en présences) |
| Observations | Observations / validations, Remarques, Notes | `planning_notes` |
| Numéro | N°, Numéro | `source_number` (affichage, jamais un identifiant) |
| Mois | Mois | contrôle de cohérence avec la date (avertissement) |
| Objectifs, Catégories, Modules, Lieu | (formats Markdown historiques) | `objectives`, catégories, modules, `planned_location` |

Dates acceptées : numéro de série Excel (calendriers 1900 et 1904), `AAAA-MM-JJ`, `JJ/MM/AAAA` (aussi `-` ou `.`), « samedi 10 octobre 2026 », « 10 oct. 2026 ». Une date inexistante est une erreur, jamais corrigée.

Commentaires de cellule : repris dans les observations (« Commentaire (colonne) : … ») ; hors du tableau, signalés. Fusions : une fusion verticale reporte la valeur sur chaque ligne ; une fusion horizontale garde la première cellule ; les deux sont signalées. Une ligne sans date ni intitulé mais non vide (note de bas de tableau) est écartée **et signalée**.

## 4. Modèle de données (migration `20261114090000_programme_excel_import`, additive)

- `activities` : `planned_format`, `planning_notes`, `source_status`, `source_attendance_count` (≥ 0), `source_number` (≥ 0) pour le prévu ; `held_by_label`, `outcomes`, `follow_up` pour le réalisé. Tous facultatifs.
- `activity_categories.planned_content` : contenu prévu d'une catégorie pour la séance. La clé primaire (activité, catégorie) garantit **un seul contenu par catégorie et par séance**. Une séance commune reste **une seule activité** (statistiques inchangées).
- `programme_imports` : historique en ajout seul (trigger `phase4_append_only`) : programme, auteur, format, nom et SHA-256 du fichier, feuille, bilan, décisions.
- `programmes_period_check` : début < fin quand la période est renseignée.

Pas de colonne « date initiale » : elle est dérivée de l'historique (`activity_events.changes.plannedOn.from` le plus ancien), alimenté par les reports, les modifications manuelles de date et les corrections du programme.

## 5. Rapprochement, conflits et idempotence

1. **Correspondance exacte** : clé `date|intitulé normalisé` (`import_key`). Clé liée à un autre programme → erreur.
2. **Rapprochement assisté** : sans clé exacte, les séances du programme de même date **ou** de même intitulé sont proposées ; rien n'est fusionné sans décision (`A_DECIDER`). Décisions : *Mettre à jour cette séance*, *Créer*, *Ignorer* (`decisions[]`), contrôlées par le serveur (séance du programme, non déjà rapprochée, choisie une seule fois) et tracées dans `programme_imports.decisions` et l'historique de la séance.
3. **Protection** : une séance saisie dans Tesla, modifiée à la main, d'un statut autre que « Planifiée », avec présences ou avec compte rendu n'est **jamais réécrite** (`CONSERVEE_MANUELLE`) : les différences sont affichées, non appliquées. Un rapprochement décidé d'une séance protégée enregistre seulement la clé technique.
4. **Absentes** : séances du programme absentes du fichier listées, **jamais supprimées**.
5. **Statut source** : reconnu seulement si la correspondance est certaine (Prévue/Planifiée, Tenue/Réalisée, Reportée, Annulée) ; il n'a aucun effet. Une séance est toujours créée « Planifiée » ; un écart avec le statut Tesla est signalé.
6. **Empreinte** : la prévisualisation renvoie un SHA-256 (fichier, feuille, en-tête, correspondance, période, état des séances concernées : révision, statut, présences, date de mise à jour). La confirmation Excel l'exige (`IMPORT_PREVIEW_REQUIRED`) et est refusée si l'état a changé (`409 IMPORT_PREVIEW_STALE`). Facultative pour le Markdown (compatibilité).
7. **Transaction** : verrou consultatif par programme, nouvelle analyse complète, refus de toute erreur (`IMPORT_HAS_ERRORS`) ou décision manquante (`IMPORT_DECISIONS_REQUIRED`) ; tout ou rien. Deux confirmations simultanées : la seconde est refusée comme périmée.
8. **Idempotence** : réimporter le même fichier ne crée ni ne modifie aucune séance (toutes « Déjà à jour ») ; seul l'historique d'import s'enrichit.

## 6. Permissions

| Action | Permission |
|---|---|
| Analyser, confirmer un import, créer un programme, modifier sa période | `programme.configure` (responsable plein en fonction) |
| Consulter programme, séances, fiche, historique des imports | `activity.read` (encadrement) |
| Saisir réalisation, présences, contenus prévus d'une séance | `activity.manage` (encadrement) |

Les routiers n'ont aucun accès à ces écrans ni à ces routes ; `/mes-activites` n'expose ni observations, ni contenus internes, ni compte rendu.

## 7. Fiche de séance « Prévu / Réalisé »

`/administration/activites/[id]` : en-tête (intitulé, statut, ligne de date « Initialement prévue le … — Réalisée le … », programme, axe, responsable prévu et effectif), puis cinq onglets :

- **Programme prévu** : temps commun, format, responsable et lieu prévus, objectifs, contenus des quatre catégories (avec rappel qu'un contenu prévu n'est pas une participation), modules, compétences visées, observations du programme, statut et effectif indiqués par le fichier.
- **Réalisation** : date effective, responsable effectif, lieu, activités menées, objectifs atteints ou non, difficultés, observations de terrain, décisions et suites, compétences observées, compte rendu ; état vide explicite ; changement de statut.
- **Présences** : saisie nominative existante (Présent, Absent, Excusé ; « Non renseigné » ≠ absent).
- **Prévu / réalisé** : tableau Date, Responsable, Lieu, Objectifs, Activités, Effectif (fichier vs saisie nominative, jamais additionnés), Observations ; « — » si absent ; empilé sur mobile.
- **Historique** : import, correction du programme, modification (champs en français), report (« date : A → B »), statut, présences, avec auteur et date.

Aucun résultat n'est prérempli ; aucune évaluation, validation d'acquis ni publication de module n'est déclenchée par le programme.

## 8. API (préfixe `/api/v1`)

| Route | Rôle |
|---|---|
| `POST /programmes` · `PATCH /programmes/:id` | créer une année · titre et période (409 `PROGRAMME_CODE_TAKEN`, `PROGRAMME_PERIOD_OVERLAP`) |
| `POST /programmes/:id/import/excel/preview` | analyse d'un classeur (base64), aucune écriture |
| `POST /programmes/:id/import/excel` | confirmation avec `fingerprint` et `decisions` |
| `POST /programmes/:id/import/preview` · `POST /programmes/:id/import` | Markdown (inchangé, décisions et empreinte facultatives) |
| `GET /programmes/:id/imports` | historique des imports |

Rapport (`programmeImportReportSchema`) : source (fichier, feuilles, ligne d'en-tête), colonnes reconnues, anomalies localisées (ligne, colonne), lignes (action, messages, candidats, différences champ par champ, raisons de protection, contenu prévu), compteurs, séances absentes, empreinte.

## 9. Hors ligne

L'import exige une connexion : l'écran le signale et n'envoie rien ; aucune écriture n'est mise en file ni annoncée comme réussie. Les réponses d'analyse (POST) ne sont pas mises en cache. La consultation hors ligne des séances et la synchronisation existantes sont inchangées.

## 10. Tests

- Unitaires : `xlsx-reader.spec.ts` (types de cellules, 1904, fusions, formules, erreurs, commentaires, non-classeur, `.xls`, macros, DTD, bombe, limites), `programme-import.spec.ts` (colonnes du modèle, variantes, colonnes inconnues, obligatoires, normalisation, dates, statuts, colonnes réordonnées). Classeurs synthétiques : `apps/api/test/xlsx-fixture.ts`.
- Intégration PostgreSQL : `test/programme-import.int-spec.ts` (permissions, prévisualisation sans écriture, quatre contenus, statut non appliqué, aucune présence, idempotence, historique en ajout seul, rapprochements, protections, absentes, empreinte périmée, concurrence, fichiers invalides, limites de corps, feuilles multiples, programmes et période, Markdown sans effacement, fiche).
- Recette du classeur réel (jamais versionné) : `PROGRAMME_XLSX=… RECETTE_OUT=… npm run test:int -w @tesla/api -- programme-recette`, puis comparaison indépendante avec le fichier.
- Navigateur : `apps/web/test/programme-import.browser.mjs` (fixture `offline-browser-fixture.mts`).

## 11. Déploiement

1. Sauvegarde PostgreSQL chiffrée avant tout (procédure [DEPLOYMENT_VERCEL_OVH.md](../DEPLOYMENT_VERCEL_OVH.md) §11).
2. Déploiement API par le workflow existant (Node.js 22 isolé) : `npm run db:deploy` applique la migration additive (aucune donnée modifiée).
3. Déploiement web Vercel.
4. Vérifications : `GET /api/v1/health` ; écran « Programme annuel » ; analyse du classeur officiel **sans confirmer** ; vérifier que le relais Vercel transmet un corps de ~350 ko (classeur officiel) et que Nginx (`client_max_body_size 10m`) l'accepte.
5. L'import du programme officiel reste une **action volontaire** du responsable depuis l'interface (jamais au déploiement).

Retour arrière : un retour applicatif laisse les colonnes et la table en place (inoffensives pour l'ancienne version). Les supprimer exigerait une migration destructive validée et la perte des données saisies dans ces champs : ne pas l'envisager sans plan.
