# Décisions techniques

Format : contexte → décision → conséquence. Ajouter une entrée pour chaque choix structurant.

## 2026-10-28 — Phase 0

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D1 | **npm workspaces**, sans Turborepo/Nx | Quatre paquets seulement ; scripts racine suffisants. |
| D2 | **TypeScript 6.0** (et non 7.0) | `typescript-eslint` 8 exige TypeScript < 6.1 ; NestJS CLI 12 utilise TypeScript 6. |
| D3 | **Prisma 7.10.1** (et non 8.0) | Le tag npm `latest` de Prisma pointe sur une RC 8.0 ; on retient la dernière stable. Prisma 7 impose un adaptateur (`@prisma/adapter-pg`) et `prisma.config.ts`. |
| D4 | **NestJS 12 en ESM** | NestJS 12 est publié en ESM uniquement : imports relatifs avec extension `.js`. |
| D5 | **Vitest** pour l'API et le web | Gabarit officiel NestJS 12 ; ESM natif. ESLint conservé (au lieu d'oxlint du gabarit Nest) pour un outil unique. |
| D6 | **Zod partagé** (`@tesla/shared`) | Un seul contrat pour la validation API et le typage du client web. Validation des DTO par Zod à généraliser à partir de la phase 1 (pas de class-validator). La documentation OpenAPI utilise des classes DTO qui `implements` le type Zod. |
| D7 | **`.env` unique à la racine** | Chargé par `process.loadEnvFile` (Node ≥ 20.12) dans l'API, Prisma et `next.config.ts` ; pas de dépendance `dotenv`. Variables système prioritaires. |
| D8 | **Healthcheck toujours 200** | Le processus est vivant ; l'état de la base est dans le corps (`degraded`). Permet au web d'afficher l'état. |
| D9 | **Composants shadcn/ui écrits à la main** (style new-york, `radix-ui`) | Le CLI shadcn nécessite le registre réseau, instable lors de l'initialisation. `components.json` permet d'utiliser le CLI ensuite. |
| D10 | **Polices système** | Pas de Google Fonts : build sans réseau, page plus légère. |
| D11 | **Service worker écrit à la main** (pas de Serwist/next-pwa) | Besoin limité (page hors ligne, cache statique) ; aucune dépendance. Enregistré en production uniquement. |
| D12 | **Pas de Redis, file de messages, microservices** | Contraintes du VPS (2 vCore, 4 Go, partagé avec SCOUT-NDPST). |
| D13 | **Rôles : `ROUTIER`, `CHEF`, `RESPONSABLE`** | Pas de rôle administrateur distinct pour l'instant (à confirmer). Synchronisation enum Prisma ↔ `@tesla/shared` vérifiée par un test. |
| D14 | **Étape courante sur `ScoutProfile`** | Historique détaillé des étapes reporté à la phase 4 ; dans l'intervalle, les changements passeront par `AuditLog`. |
| D15 | **Pas de comptes de développement** | L'authentification n'est pas opérationnelle ; le seed ne crée que les étapes de progression. |
| D16 | **`agentRules: false`** dans Next | Évite la génération d'un `apps/web/AGENTS.md` en doublon ; l'information utile est dans `.claude/rules/frontend.md`. |
| D17 | **Espaces non protégés en phase 0** | Ils n'affichent aucune donnée personnelle ; un bandeau l'indique. Protection par rôle en phase 1. |
| D18 | **PostgreSQL exposé sur le port hôte 5433** | Le port 5432 est déjà utilisé par un autre projet sur le poste de développement ; 5433 évite le conflit. Modifiable via `POSTGRES_PORT` et `DATABASE_URL`. |

## 2026-10-28 — Routiers sans compte, équipes, évaluations papier

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D19 | **`ScoutProfile` conservé comme profil routier**, `userId` rendu facultatif ; identité (`firstName`, `lastName`) portée par le profil | Évolution additive plutôt qu'un nouveau modèle : le profil devient la référence métier, le compte un simple accès. Nom et prénom existent aussi sur `User` (compte) ; le profil fait foi pour le suivi. |
| D20 | **Noms de modèles en anglais** (`Team`, `TeamAssignment`, `EvaluationAttempt`, `EvaluationWaiver`…), valeurs d'enum en français (`PAPIER`, `PREPAREE`…) | Convention existante du code (`User`, `ScoutProfile`, enum `Role` en français). Correspondance documentée dans `DATABASE.md`. |
| D21 | **Code de tentative par compteur annuel transactionnel** (`attempt_code_counters`, `INSERT … ON CONFLICT DO UPDATE … RETURNING`) | Sûr en concurrence (verrou de ligne), sans boucle de collision, numérotation sans trou visible. Rejeté : séquence PostgreSQL unique (pas de remise à zéro annuelle simple), séquence par année (DDL dynamique), aléatoire (collisions, pas lisible). Année = année civile **UTC** (Abidjan est en UTC+0). |
| D22 | **Contraintes critiques en base** : CHECK (matricule, code, score), exclusion `btree_gist` (affectations), triggers d'immutabilité et d'ajout seul | Les règles RM-002, RM-004, RM-007, RM-011 restent garanties même hors service (script, futur module). Extension `btree_gist` fournie par l'image PostgreSQL officielle. |
| D23 | **Preview Prisma `partialIndexes`** pour les index uniques partiels | Sans elle, Prisma ne connaît pas ces index et proposerait de les supprimer à la migration suivante. Risque : fonctionnalité en preview, à surveiller lors des montées de version de Prisma. |
| D24 | **Statut de tentative ≠ validation d'étape** : `VALIDEE`/`REFUSEE` = décision du responsable sur un résultat ; la validation officielle d'acquis/étape sera un acte distinct (modèle prévu en phase 4) | Respect de la règle « validation exclusivement humaine » ; aucun service n'écrit `current_stage_id`. |
| D25 | **Historique des tentatives** dans `evaluation_attempt_events` (ajout seul) + `AuditLog` pour les actions sensibles (décision, réouverture, annulation, dérogations, rattachement de compte, matricule) | Les réponses originales et chaque correction restent consultables ; l'audit global reste exploitable. |
| D26 | **Une tentative ouverte par routier et par évaluation** (index unique partiel) | Évite les doublons accidentels (double clic, deux chefs) ; repasser exige de clore la tentative précédente puis une préparation explicite. |
| D27 | **Services sans routes HTTP** dans cette phase ; nouveaux modules `scouts` et `evaluations` ; permissions centralisées (`common/permissions.ts`) | Pas d'authentification encore : exposer des routes sans acteur fiable serait dangereux. Les modules réservés (`users` = comptes, `pedagogy` = contenus) ne couvrent pas ces domaines. |
| D28 | **Tests d'intégration sur base réelle dédiée** (`tesla_test`, `npm run test:int`), hors `npm run test` et hors CI pour l'instant | Les contraintes SQL, triggers et la concurrence ne sont pas testables avec une base simulée. Ajout d'un service PostgreSQL en CI à décider. |
| D29 | **Recherche par code refusée = 404** pour un routier non titulaire | Ne révèle pas l'existence d'une tentative à partir d'un code deviné. |
| D30 | **Choix provisoires à confirmer** : éligibilité = étape courante uniquement ; toute version publiée imprimable ; dérogation valable jusqu'à expiration/révocation ; inscription des routiers par les chefs ; équipes gérées par le responsable ; un chef peut annuler une tentative | Centralisés dans `eligibility.ts` et `permissions.ts` pour être modifiés en un seul endroit. |

| D31 | **Format officiel du matricule : 7 chiffres + 1 lettre** (`^[0-9]{7}[A-Z]$`), confirmé par le responsable comme invariable | Remplace la règle provisoire de D30. Contrainte SQL remplacée par une nouvelle migration (la précédente, déjà appliquée, n'est pas modifiée). Aucune conversion automatique 0 ↔ O : une saisie non conforme est refusée. |

## 2026-10-29 — Authentification, équipes, routiers, observations

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D32 | **Permissions resserrées** : inscription, modification de fiche, matricule, affectation et gestion des équipes → responsable ; chefs → consultation et observations | Conforme à la mission de phase 1 ; remplace les choix provisoires de D30 (inscription et affectation par les chefs). Toujours modifiable dans `common/permissions.ts`. |
| D33 | **Sessions serveur opaques** (256 bits, hash SHA-256 en base) plutôt que JWT | Révocation immédiate (déconnexion, compte désactivé), aucun secret de signature à gérer. Durée **absolue** de 12 h (`SESSION_TTL_HOURS`), sans prolongation glissante. |
| D34 | **Argon2id** (`argon2`, m = 19 Mio, t = 2, p = 1 — recommandation OWASP) | Seule dépendance ajoutée à l'API. Vérification factice pour un compte inconnu (pas de fuite par la durée). |
| D35 | **CSRF : SameSite=Lax + en-tête `x-tesla-csrf` + contrôle de l'origine** sur les écritures | Un en-tête personnalisé impose un pré-vol CORS refusé aux origines non déclarées ; pas de jeton synchronisé à gérer. |
| D36 | **Limitation des tentatives en mémoire** (5 échecs / 15 min par IP+e-mail, 20 par IP) | Instance unique sans Redis (D12). Réinitialisée au redémarrage ; `TRUST_PROXY=true` requis derrière Nginx. |
| D37 | **Protection des pages web optimiste** (`proxy.ts` : présence du cookie) + `SessionGate` (`/auth/me`, rôle) | La sécurité réelle est dans l'API ; le cookie posé par l'API (port 4000) est visible du web (port 3000) car les cookies ignorent le port ; même domaine en production. |
| D38 | **Swagger généré depuis les schémas Zod** (`z.toJSONSchema`, cible OpenAPI 3.0) | Évite des classes DTO dupliquées ; complète D6. |
| D39 | **Observations** : visibilité `ENCADREMENT` (chefs + responsable) ou `RESPONSABLE` (responsable + auteur), jamais visibles des routiers ; modification par l'auteur seul, version précédente conservée ; jamais supprimées ; catégorie en **libellé libre** | Aucune liste de catégories n'a été arbitrée (à confirmer). Tous les chefs sont « habilités » (une seule communauté) — à confirmer. |
| D40 | **Archivage d'équipe** = clôture des affectations ouvertes à la date du jour + `archivedAt`, sans désarchivage | Conserve l'historique ; les routiers concernés restent sans équipe. |
| D41 | **Désactivation d'un routier** clôt son affectation ouverte ; un routier désactivé ne peut pas être affecté | Évite de compter un routier parti parmi les membres d'une équipe. |
| D42 | **Changement d'étape** : par `PATCH /scouts/:id` (responsable seul), journalisé `scout_profile.stage_changed` | Historique des étapes via `AuditLog` en attendant le modèle de validation officielle (phase 4, D14/D24). |
| D43 | **Homonymes** : inscription d'un nom + prénoms identiques (casse ignorée) refusée sauf confirmation explicite (`confirmDuplicate`) | Prévention des doublons sans bloquer de vrais homonymes ; les accents ne sont pas normalisés. |

## 2026-10-29 — Modules pédagogiques et publication (phase 2)

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D44 | **Éditeur Tiptap 3.31.4** (version épinglée, publiée un mois avant), contenu stocké en **JSON ProseMirror** validé par liste blanche Zod partagée, rendu par un composant React dédié | Éditeur structuré éprouvé, compatible React 19 ; aucun HTML stocké ni interprété (`dangerouslySetInnerHTML` proscrit). Dépendances limitées au web (`@tiptap/react`, `pm`, `starter-kit`, `extension-image`), chargées seulement sur les pages d'édition. Rejeté : HTML assaini (risque résiduel, dépendance de nettoyage), éditeur maison (coût). |
| D45 | **Étape recommandée et thème portés par la version**, slug fixé à la création du module | Changer l'étape d'un module publié passe par l'approbation ; les URL de la bibliothèque restent stables malgré un changement de titre. |
| D46 | **États** `BROUILLON`, `SOUMIS`, `A_CORRIGER`, `REFUSE`, `APPROUVE`, `PUBLIE`, `ARCHIVE` ; reprise explicite `A_CORRIGER → BROUILLON` ; le responsable peut aussi retirer une approbation non publiée (`APPROUVE → A_CORRIGER`, motif) | Évite qu'une version approuvée devenue inadaptée bloque le module. Le remplacement par une nouvelle publication archive l'ancienne (événement `REMPLACEE`). À confirmer. |
| D47 | **Une seule version de travail par module** ; nouvelle version = copie de la version publiée (à défaut, de la plus récente) ; les leçons copiées reçoivent de nouveaux identifiants | Pas de branches concurrentes. Conséquence : un lien direct vers une leçon d'une version remplacée renvoie 404 (le module reste accessible par son slug). |
| D48 | **Concurrence optimiste** : `revision` sur la version (informations) et sur chaque leçon ; verrous `FOR UPDATE`/`FOR SHARE` sur la version ; réordonnancement par liste complète ; enregistrement explicite (pas d'autosauvegarde) | Deux chefs peuvent rédiger des leçons différentes simultanément ; aucune écriture n'écrase silencieusement une autre (409 + rechargement proposé). |
| D49 | **Garanties en base** : triggers (contenu figé hors brouillon, transitions, pointeur de publication, historique en ajout seul), index uniques partiels (une version de travail, une version publiée) | Règles RM-021 à RM-023 maintenues même hors service (script SQL). Cohérent avec D22. |
| D50 | **Collaborateurs** : l'auteur et le responsable invitent ou retirent ; le collaborateur rédige et soumet ; un chef non invité ne voit pas le module (404) | Moindre privilège ; à confirmer (un collaborateur peut-il inviter ?). |
| D51 | **Ressources par URL externe uniquement** ; vidéos limitées à YouTube et Vimeo (`ALLOWED_VIDEO_HOSTS`, liste provisoire) ; images de leçon en `https` | Aucun fichier lourd sur le VPS (D12) ; pas de service de stockage à ce stade. Les vidéos sont proposées en lien, pas intégrées (pas d'iframe ni de CSP à étendre). |
| D52 | **Le responsable accède à l'espace de rédaction** (`/chef/modules`) en plus de ses écrans de validation | Les règles autorisent le responsable à créer et modifier ; un seul éditeur à maintenir. |
| D53 | **Impression par le navigateur** (`/modules/:slug/imprimer`, `@media print`, A4) ; PDF serveur reporté | Suffisant pour le support de cours ; pas de moteur PDF sur le VPS à ce stade. |
| D54 | **Progression de lecture non modélisée** | Facultative selon la mission ; nécessiterait un modèle lié au profil routier (à décider avec le hors-ligne, phase 3). |
| D55 | **Thème en libellé libre**, filtre construit à partir des thèmes des modules publiés | Aucune liste officielle de thèmes n'est arbitrée ; les thèmes de la mission sont des exemples. |
| D56 | **Code interne `MOD-NNN`** dérivé d'une séquence PostgreSQL (`SERIAL`) | Lisible, unique ; un numéro peut être sauté si une création échoue (sans conséquence). |

## 2026-10-29 — Évaluations, papier et résultats (phase 3)

| N° | Décision | Justification |
| --- | --- | --- |
| D57 | **Extension des tables existantes** (`evaluations`, `evaluation_versions`, `evaluation_attempts`, `evaluation_waivers`) plutôt que de nouveaux modèles parallèles ; questions, propositions et réponses en **tables relationnelles** ; colonnes JSON de la phase 1 bis conservées (nullables, plus utilisées) | Les tentatives, codes et dérogations existants restent valides ; triggers et index protègent chaque question et chaque réponse ; aucune suppression de colonne (migration additive). |
| D58 | **Workflow des questionnaires identique à celui des modules** (mêmes états, transitions, historique, publication atomique) ; étape et module **figés après la première publication** | Un seul modèle mental pour les chefs et le responsable. Changer l'étape d'une évaluation publiée modifierait l'éligibilité de tentatives déjà passées : on crée une nouvelle évaluation. |
| D59 | **Éligibilité provisoire** : étape courante = étape de l'évaluation, ou déblocage actif ; le déblocage lève l'étape, **pas** la limite de tentatives ; une tentative ouverte se reprend | Reprend la règle provisoire de la phase 1 bis (à confirmer) ; aucune correspondance programme annuel ↔ étapes n'est codée. |
| D60 | **Crédit partiel** des choix multiples : (bonnes cochées − mauvaises cochées) ÷ nombre de bonnes réponses, borné à 0, arrondi au centième ; politique choisie **par question** (défaut : tout ou rien) | Décourage le « tout cocher » sans pénalité négative ; formule à confirmer par le responsable. |
| D61 | **Le routier voit son résultat après acceptation par le responsable** : score, points et appréciations par question, commentaire du responsable ; **jamais les bonnes réponses** | Évite la diffusion du corrigé entre routiers ; la correction détaillée reste orale ou en séance. À confirmer. |
| D62 | **Pas de nouvel état `EXAMINEE`** : `VALIDEE` = « résultat accepté », `REFUSEE` = « résultat non retenu » (libellés modifiés) ; la **validation officielle des acquis** sera un modèle distinct (phase 4), non créé maintenant | Évite une migration d'enum et toute ambiguïté : aucun statut de tentative n'est une validation d'acquis. Pas de table inutilisée. |
| D63 | **PDF serveur avec pdfkit 0.20** (JS pur, polices standard Windows-1252, en mémoire, `Cache-Control: no-store`) ; logo lu dans `apps/web/public/brand/` s'il existe | Léger pour le VPS (pas de Chromium serveur) ; caractères hors Windows-1252 remplacés par « ? ». Le questionnaire du routier est construit à partir de données expurgées du corrigé. |
| D64 | **Routes de correction communes** papier/en ligne : `/corrections/:code/answers` et `/submit-review` au lieu de `/paper-attempts/:code/…` ; `GET /evaluations?scoutProfileId=` sert de contrôle d'éligibilité papier | Un seul circuit de correction ; adaptation autorisée par la mission. |
| D65 | **Tout chef corrige toute copie** et consulte les corrigés ; un questionnaire est rédigé par son auteur, les rédacteurs du module évalué et le responsable | Une seule communauté ; à restreindre par équipe si le responsable le demande. |
| D66 | **Aucun seuil de réussite ni minuteur** : durée indicative seulement ; nombre maximal de tentatives facultatif (défaut : sans limite) | Valeurs non arbitrées (règle pédagogique 7). |
| D67 | **Une copie entièrement objective passe aussi par un chef** (soumission explicite), puis par le responsable | Le score automatique n'est jamais communiqué ni retenu sans intervention humaine. |

## Décisions pédagogiques en attente (responsable)
Voir [BUSINESS_RULES.md](BUSINESS_RULES.md#points-en-attente-darbitrage-ne-pas-coder-de-valeur-définitive) : durées d'étape selon l'âge, conditions d'accès aux évaluations, seuils, gestion des comptes, conservation des données.

## 2026-10-29 — Progression, compétences et activités (phase 4)

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D68 | Historique structuré d'étapes immuable, correction par ajout | Décision et actualisation du profil dans une transaction verrouillée ; anciennes décisions reprises depuis l'audit. |
| D69 | Acquis distinct du résultat de quiz | Proposition avec preuves, décision du responsable, révocation motivée et historisée ; aucune automatisation pédagogique. |
| D70 | Catégories du programme distinctes des étapes | Correspondances proposées non confirmées ; confirmation explicite par le responsable. Aucune équivalence automatique. |
| D71 | Référentiel de compétences administrable et initialement vide | Domaines, critères et minimum de preuves à définir par le responsable ; aucune compétence officielle inventée. |
| D72 | Import Markdown prévisualisé, clé date/titre | Réimport idempotent, refus des erreurs, conservation des modifications manuelles. Source officielle du programme absente du dépôt : séances à fournir. |
| D73 | Absence de saisie différente d'absence | Présent/absent/excusé explicites ; unicité activité/profil ; saisie groupée journalisée. |
| D74 | Deux dernières présences renseignées absentes : signal provisoire | Indicateur d'accompagnement uniquement, à confirmer par le responsable ; aucune sanction ou décision automatique. |
| D75 | Chemins de suivi partagés sous `/administration` | Chef et responsable utilisent les mêmes dossiers et activités, avec actions contrôlées côté API ; pas de doublon de pages `/chef`. |
| D76 | Coquille publique `/hors-ligne` comme entrée hors ligne unique | `/telechargements` et `/synchronisation` en sont des alias ; seule cette coquille générique est pré-cachée, aucune page privée ni réponse d'API n'est mise en cache. |
| D77 | Un enregistrement chiffré par module et par tentative (IndexedDB v2 : `records`, `settings`) | Remplace les collections conceptuelles séparées : écriture atomique, révision optimiste entre onglets, pas d'orphelin ; magasins v1 laissés intacts. |
| D78 | Réservation hors ligne de 24 h, réception avant expiration, droits revérifiés, rejet motivé | Heure de l'appareil indicative seulement ; rejet → tentative `ANNULEE` non comptée, copie locale conservée. **Provisoire** : durée, rejet plutôt que mise en attente et conservation serveur des copies rejetées à valider par le responsable. |
| D79 | Coffre local chiffré (PBKDF2-SHA-256 600 000 itérations + AES-GCM 256) avec phrase locale | IndexedDB n'est pas chiffré par le navigateur ; clé en mémoire uniquement, verrouillage à la déconnexion sans suppression des copies ; un compte routier par profil de navigateur ; phrase oubliée = données perdues. Mode hors ligne réservé aux routiers. |
| D80 | Autorisation opaque enregistrée en base plutôt que jeton signé | Révocable et contrôlable côté serveur, aucun secret de signature à gérer, inutilisable sans la session du même compte. |
| D81 | Idempotence par `operationId` unique + empreinte SHA-256 de la copie | Même envoi → même statut ; autre copie → `409` sans écraser les réponses officielles ; verrou de ligne dans la transaction. |
| D82 | File locale bornée sans Background Sync | Envois au retour du réseau, à l'ouverture, au premier plan, au déverrouillage et manuellement ; 5 s × 2ⁿ plafonné à 30 min, 6 envois automatiques puis manuel ; erreur réseau distincte d'un rejet métier. |
| D83 | Téléchargement atomique et borné | Empreinte vérifiée, images limitées (3 Mo, 30 Mo par module, formats image uniquement), vidéos et ressources externes jamais téléchargées ; un échec n'écrit rien et conserve la version précédente. |

À arbitrer : référentiel officiel de compétences, correspondances catégories/étapes, conditions et durées de passage, périmètre éventuel des chefs par équipe, signal d'absence D74 et document source du programme annuel.
