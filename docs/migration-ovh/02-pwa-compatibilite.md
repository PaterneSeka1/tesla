# 02 — Compatibilité de la PWA installée

Principe : pour le navigateur, **rien ne change**. L'origine (`https://nikola-tesla-academie.vercel.app`) reste la même ; or l'installation, l'enregistrement du service worker, Cache Storage, IndexedDB et le cookie de session sont tous rattachés à l'origine. Seul le serveur qui fabrique les réponses change, derrière Vercel.

## 1. Manifeste

Généré par `apps/web/src/app/manifest.ts`, servi sous `/manifest.webmanifest`.

| Champ | Valeur | Après migration |
| --- | --- | --- |
| `id` | `/` | identique |
| `name` / `short_name` | Nikola Tesla Académie / Tesla Académie | identiques |
| `start_url` / `scope` | `/` / `/` | identiques |
| `display` | `standalone` | identique |
| `theme_color` / `background_color` | `#510D12` / `#FCF9F4` | identiques |
| `icons` | `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png` | mêmes fichiers (`apps/web/public/icons`) |

Vérifié le 2026-11-17 : le manifeste de production (Vercel) et celui du build OVH sont **identiques octet pour octet**. Aucune modification du manifeste n'est faite par la migration.

## 2. Service worker (`apps/web/public/sw.js`)

| Point | Constat |
| --- | --- |
| URL et scope | `/sw.js`, scope `/` ; même origine → enregistrement conservé |
| Contenu | identique en production et dans le dépôt (SHA-256 identique) → **aucune mise à jour déclenchée** par la migration |
| En-têtes | `Cache-Control: no-cache, no-store, must-revalidate` (next.config.ts), contrôlé derrière le vhost d'origine |
| Mise à jour | pas de `skipWaiting` automatique : l'application propose la mise à jour (message `SKIP_WAITING`) |
| Nettoyage | `activate` ne supprime que les caches `tesla-*` absents de `KEPT_CACHES` ; IndexedDB jamais touché |
| API | `/api/*` jamais mis en cache ; données hors ligne dans le coffre IndexedDB chiffré |
| Pages | `tesla-pages` (HTML générique), `tesla-rsc`, `tesla-static` (ressources) ; secours `/hors-ligne` |

Conséquence du changement de build : les noms des scripts changent (comme à chaque déploiement Vercel). Les pages déjà préparées restent servies hors ligne avec leurs anciens scripts conservés en cache ; une préparation refaite en ligne enregistre les nouveaux. Recommandation aux utilisateurs après la bascule : ouvrir « Cet appareil » et relancer la préparation hors ligne une fois en ligne.

Amélioration attendue : voir [01-audit.md](01-audit.md) § 6 (préparation hors ligne complète une fois servie par OVH).

## 3. Données hors ligne

Inchangées par la migration (aucun code client modifié). Rappel de l'existant ([OFFLINE_FIRST.md](../OFFLINE_FIRST.md)) : coffre IndexedDB chiffré par compte (clé d'appareil remise par l'API, inchangée), opération non confirmée jamais supprimée automatiquement (déconnexion, mise à jour, quota ; seul « Abandonner » confirmé la retire). Aucune migration de schéma local n'est nécessaire. Limite inchangée : Safari iOS peut effacer le stockage d'une PWA inutilisée pendant 7 jours.

Point d'attention : pendant le redémarrage de `tesla-web@` (quelques secondes), une navigation reçoit la page de maintenance (réponse HTTP, donc pas de bascule sur le cache hors ligne). Les envois de la file d'opérations passent par `/api/v1`, servi par l'API et non par Next.js : ils ne sont pas affectés par un redémarrage du web.

## 4. Protocole d'essai sur appareils réels (à exécuter, non réalisé)

À faire sur au moins un Android (Chrome) et un iPhone (Safari) **ayant installé la PWA avant la bascule**, avec un compte de test (jamais un compte réel de routier).

| # | Étape | Attendu |
| --- | --- | --- |
| 1 | Avant bascule : ouvrir la PWA installée, se connecter | accueil |
| 2 | « Cet appareil » : préparer hors ligne, puis ouvrir un module | préparation terminée |
| 3 | Mode avion : consulter un cours, saisir une action autorisée hors ligne | consultation possible, opération en attente |
| 4 | Revenir en ligne | opération synchronisée |
| 5 | Mode avion, saisir une seconde opération, **laisser en attente** | opération en attente |
| 6 | Bascule (07-bascule-vercel.md) | — |
| 7 | Relancer la PWA installée (sans réinstaller) | s'ouvre en plein écran, **toujours connecté** |
| 8 | Revenir en ligne | l'opération de l'étape 5 est synchronisée |
| 9 | Consulter un cours préparé hors ligne, mode avion | consultable |
| 10 | Préparer de nouveau hors ligne | réussite |
| 11 | Vérifier qu'aucune invitation de mise à jour ni de réinstallation n'apparaît | aucune |

Résultats à consigner dans [06-tests.md](06-tests.md) : appareil, version du système, navigateur, heure, résultat, capture.
