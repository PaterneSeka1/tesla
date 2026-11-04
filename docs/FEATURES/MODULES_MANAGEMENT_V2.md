# Gestion des modules V2 (D171)

Pages : `/administration/modules` (« Tous les modules », responsable plein) et `/encadrement/modules` (« Mes modules », encadrement). Même composant (`EditorModuleList`).

## Modules et versions
Un module est l'entité durable ; ses versions ne sont jamais comptées comme des modules. La liste affiche, pour chaque module, la **version affichée** (version de travail, sinon publiée, sinon la plus récente), l'**état de publication** (« En ligne · vN », « Publication retirée », « Jamais publié ») et la **version de travail** (statut éditorial) séparément. Un module publié avec un brouillon reste affiché comme publié.

## Recherche et filtres (serveur)
`GET /api/v1/editor/modules` — paramètres (tous facultatifs, combinables) :

| Paramètre | Valeurs |
|---|---|
| `search` | titre, résumé, thème de la version affichée ; code (`MOD-012`, `12`) ; nom de l'auteur. Casse et accents ignorés, jokers neutralisés |
| `status` | `all`, `working`, `BROUILLON`, `SOUMIS`, `A_CORRIGER`, `APPROUVE` (version de travail), `PUBLIE` (en ligne), `REFUSE`/`ARCHIVE` (module sans version de travail ni publiée) |
| `publication` | `current`, `never`, `withdrawn`, `with_working` |
| `stageId`, `category` | portent sur la version affichée |
| `author` | `me` ou identifiant |
| `collaboration` | `mine`, `collaborating`, `action` (responsable : soumis ou approuvés ; chef : à corriger) |
| `origin` | `import`, `manual` |
| `evaluation` | `with`, `without`, `published` |
| `lessons` | `with`, `without` (version affichée) |
| `dateField`, `from`, `to` | `updated`/`created`, jours `AAAA-MM-JJ` inclus |
| `sort` | `updated_desc` (défaut), `updated_asc`, `created_desc`, `created_asc`, `title_asc`, `title_desc`, `code_asc`, `code_desc` ; départage par numéro |
| `page`, `pageSize` | pagination serveur (≤ 100) |

Le périmètre reste celui de `module.write` : un chef ne voit que ses modules et ceux auxquels il collabore. `GET /api/v1/editor/module-stats` : `accessible`, `published`, `neverPublished`, `pendingApproval` (modules distincts du périmètre).

Interface : quatre contrôles permanents (recherche avec temporisation 350 ms, statut, étape, tri), panneau « Filtres avancés » repliable, vues rapides (Tous, Mes brouillons, À approuver — responsable —, Publiés, Sans questionnaire) qui ne sont que des préréglages, pastilles supprimables, nombre de résultats, réinitialisation. Tout l'état est dans l'URL (`src/lib/module-list-params.ts`) ; les pages du module reçoivent `?retour=` (chemins de liste internes seulement) pour revenir à la liste filtrée. Aucune préférence n'est enregistrée en base.

Affichage : tableau à partir de 768 px (colonnes secondaires masquées selon la largeur), cartes en dessous ; menu d'actions par module (Modifier/Consulter, Prévisualiser, Voir dans la bibliothèque, Examiner et approuver / Publier, Historique, Dupliquer, Créer une nouvelle version, Archiver la publication, Supprimer le brouillon / Abandonner la version de travail). Approbation, publication et archivage restent sur la page de révision. Toutes les décisions sont revérifiées par l'API.

## Suppression individuelle d'un brouillon
- `GET /api/v1/editor/modules/:id/draft-deletion` : diagnostic (`kind`, titre, code, statut, leçons, ressources, version publiée, `allowed`, `blockers`).
- `POST /api/v1/editor/modules/:id/draft-deletion` `{ versionId }` → `{ kind, moduleId, versionId }`.

| Cas | Résultat |
|---|---|
| Module jamais publié, version unique en brouillon jamais soumis | module supprimé avec leçons, ressources et textes cités de la version |
| Module publié (ou retiré) + version de travail en brouillon jamais soumis | seule la version de travail est abandonnée |
| Module publié sans brouillon | refus `422 DRAFT_NOT_DELETABLE` → archivage |
| Brouillon déjà soumis (même revenu en brouillon après corrections) | refus : historique des décisions conservé |
| Importé, collaborateurs, fichiers téléversés, questionnaire, études/activités/compétences/rattrapages, cité | refus avec la cause |

Droits : auteur du brouillon ou responsable plein ; collaborateur `403`, chef sans accès `404`, routier et administrateur `403`. Une seule cible par appel ; aucune route par lot. Transaction : verrou du module (`FOR UPDATE`), diagnostic refait, `delete_module_draft` (contrôles répétés en SQL, triggers levés pour ce seul module), `audit_logs` (`module.draft_deleted` / `module.draft_version_discarded`). Une seconde demande simultanée reçoit `404` ou `409 DRAFT_CHANGED`. Les fichiers stockés ne sont jamais supprimés. Interface : confirmation avec titre, code, statut, nombre de leçons et conséquences ; bouton désactivé pendant l'envoi ; succès annoncé après la réponse du serveur ; liste, compteurs et page courante actualisés.

## Limites
- Tri par titre : ordre des caractères après repli (l'apostrophe typographique « ’ » se classe après les lettres : « L’Entreprise » après « Loi »), pas une collation française complète.
- Recherche par `LIKE` sur les versions affichées : suffisante pour quelques centaines de modules ; aucun index ajouté (non mesuré nécessaire).
- Suppression d'un brouillon déjà soumis non prévue (refus par le responsable à la place).
