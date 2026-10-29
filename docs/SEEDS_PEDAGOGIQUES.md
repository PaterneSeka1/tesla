# Seeds pédagogiques

Import, en brouillon, de modules pédagogiques issus de documents fournis par la communauté. Un import ne publie rien, n'approuve rien et ne remplace jamais un travail déjà fait dans la plateforme.

## Sources

| Source | Rôle | Disponibilité |
| --- | --- | --- |
| `BASE DU SCOUTISME.pdf` (6 pages, SHA-256 `cc40c92e…29b8d9`) | Source principale des textes | `docs/sources/` |
| `Nikola_Tesla_Modules_Scoutisme.md` | Proposition de découpage, d'étapes et d'objectifs | `docs/sources/` |
| Manuel pédagogique SAPF-Route | Référentiel des étapes | **absent du dépôt** — non utilisé |
| `docs/PROGRAMME_ANNUEL_2026-2027.md` | Programme de l'année | **absent du dépôt** — non utilisé |

Aucun contenu n'a été inventé pour remplacer les documents absents. Le texte du PDF a été extrait mécaniquement puis repris tel quel (coquilles comprises) ; un contrôle automatique a vérifié que chaque texte de leçon figure dans le PDF, à l'exception des ajouts éditoriaux signalés ci-dessous. Les deux sources sont versionnées dans `docs/sources/` à la demande du responsable.

## Modules importés

| Code stable | Slug | Étape recommandée | Leçons (dont vides) | Pages |
| --- | --- | --- | --- | --- |
| `NT-SCOUT-M01` | `nt-scout-m01-decouvrir-le-scoutisme` | Noviciat | 5 (0) | 1 à 3 |
| `NT-SCOUT-M02` | `nt-scout-m02-loi-principes-et-vertus` | Noviciat | 4 (1) | 2 |
| `NT-SCOUT-M03` | `nt-scout-m03-la-methode-scoute` | Apprentissage | 7 (6) | 1 |
| `NT-SCOUT-M04` | `nt-scout-m04-initiation-au-morse` | Apprentissage | 5 (1) | 3 à 6 |

21 leçons, dont 13 avec contenu source et 8 vides. Le code affiché dans la plateforme (`MOD-00x`) reste attribué par PostgreSQL ; le code `NT-SCOUT-Mxx` est la clé de réexécution, conservée dans la provenance.

Ajouts éditoriaux (absents du PDF) : la mention « Source : « Base du scoutisme », p. X » en fin de leçon, le titre « Le fondateur du scoutisme » (en majuscules dans la source), la phrase d'introduction et les titres « Lettres » / « Chiffres » de la leçon sur l'alphabet Morse.

**Alphabet Morse** : l'illustration de la p. 4 est transcrite en liste (A–Z, 1–9, 0 ; « · » point, « — » trait). L'image n'est pas importée : provenance et droits non établis, et la plateforme n'accepte que des images en URL https externe.

## Correspondance avec les étapes

L'étape portée par chaque module est une **recommandation de lecture** reprise du document de découpage. Elle ne conditionne ni la consultation, ni l'éligibilité aux évaluations, ni la progression. Le responsable peut la modifier dans le brouillon. Les objectifs viennent aussi du document de découpage et restent à valider.

## Contenus à compléter

- **Leçons vides** (soumission refusée tant qu'elles ne sont pas rédigées) : M02 « Comprendre et appliquer la loi dans la vie quotidienne » ; M03 « Loi et promesse », « Vie en petit groupe », « Vie dans la nature », « Soutien adulte et cadre symbolique », « Éducation par l'action », « Progression personnelle et engagement communautaire » ; M04 « Exercice de transmission en équipe ».
- **Développements absents** : origines du scoutisme (M01), signification de la fleur de lys et rôle de l'OMMS (M01), promesse scoute (M03), durées du point, du trait et des silences (M04).
- **Évaluations** : la source ne contient aucune question. Aucun questionnaire n'est créé ; chaque module porte la note « Évaluation à préparer ». Les chefs les construiront selon le workflow d'approbation des évaluations.

## Points à vérifier avant publication

- M01 : « Stephenson Smith Robert Baden Powell », « Olave Sain Clair » ; « OMMS … (Malaysi) » ; chronologie entière, en particulier l'entrée 1937 (date, paroisse, nom du prêtre) ; coquilles (« appelé la méthode scout », « intellectuel, spirituel et Social », « Arrivé »).
- M02 : formulation des dix articles à confronter au texte officiel du mouvement ; accords « Principes Social », « Principes Personnel ».
- M04 : invention attribuée à Samuel Morse seul puis à Morse et Vail ; transcription de l'alphabet à relire contre l'illustration ; codes des abréviations non conformes à l'alphabet de la p. 4 (ex. « GA : ·-· » = R, « GN : -. » = N, « SOS : ···—··· », « CQ », « BT », « SK ») et doublons (BSR, BJR, CUL, GA, OM, SK, SOS, Merci).

Ces points figurent dans les **notes éditoriales** de chaque module (table `module_source_imports`), visibles des rédacteurs dans l'éditeur et l'écran de révision, jamais des routiers (ni bibliothèque, ni paquet hors ligne, ni impression).

## Commandes

```bash
npm run db:seed                          # seed principal : étapes, programme, puis modules pédagogiques
npm run db:seed:pedagogy                 # modules pédagogiques seuls (étapes déjà présentes)
npm run db:seed:pedagogy -- --dry-run    # prévisualisation : rapport sans aucune écriture
```

Fichiers : `apps/api/prisma/seeds/scoutisme-base.seed.ts` (contenu), `source-modules.ts` (import), `pedagogy.ts` (commande dédiée).

## Réexécution sans écrasement

- Module absent : création en **une transaction** — module et version 1 `BROUILLON` sans auteur humain (`created_by_id` nul = système), leçons, événement « créée » sans acteur, provenance, entrée d'audit `module.imported` (acteur nul).
- Module déjà importé (même code) : **aucune écriture**, quel que soit son état. Le rapport indique les écarts entre la source actuelle et l'instantané importé (empreinte SHA-256 canonique) et les évolutions depuis l'import (leçons modifiées, état, version publiée). Les écarts se reportent à la main dans une version de travail.
- Slug déjà pris par un autre module : import ignoré et signalé.
- Aucune suppression, aucune mise à jour : la provenance est en ajout seul (trigger) et le système ne peut enregistrer qu'une création dans l'historique (contrainte `module_version_events_system_actor_check`).

## Procédure après import

1. Le responsable ouvre **Tous les modules** (`/administration/modules`, filtre « En cours ») : les quatre modules apparaissent avec l'auteur « Import système ». Ils ne sont visibles d'aucun chef tant que le responsable ne les invite pas comme collaborateurs (panneau « Collaborateurs » de l'éditeur).
2. Dans l'éditeur (`/chef/modules/<id>/modifier`), l'encart « Module importé d'une source documentaire » liste les notes à traiter.
3. Rédiger les leçons vides, vérifier les points signalés, ajuster étape et objectifs.
4. Soumettre (chef collaborateur ou responsable), puis approuver et publier par le responsable (`/administration/modules-a-valider`). Chaque décision est attribuée à une personne.
5. Préparer les évaluations dans le workflow habituel.
