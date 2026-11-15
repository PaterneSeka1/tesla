# Recette de la refonte UX — 2026-11-15

Environnement : WSL2, PostgreSQL 18 (`tesla-postgres`, base **`tesla_test`** uniquement, données fictives), API compilée (`NODE_ENV=development`, stockage objet simulé), web de **production** (`next build` + `next start`, service worker actif), Chromium 1248 via `playwright-core` 1.64.1 hors dépôt.

## 1. Vérifications automatiques

| Commande | Résultat |
| --- | --- |
| `npm run lint` | OK (0 erreur, 0 avertissement) |
| `npm run typecheck` | OK |
| `npm run test` | 287 tests API + 112 tests web réussis |
| `npm run test:int -w @tesla/api` (`tesla_test`) | 183 réussis, 1 ignoré (préexistant), 24 fichiers |
| `npm run build` | OK (shared, API, web) |

## 2. Recettes navigateur

| Recette | Contrôles | Résultat |
| --- | --- | --- |
| `editeur-pedagogique.browser.mjs` (nouvelle) | 15 | Réussie (2 passages) |
| `offline-auth.browser.mjs` (nouvelle) | 17 | Réussie (2 passages complets ; 1 passage antérieur interrompu à la reconnexion, non reproduit) |
| `offline-first.browser.mjs` (adaptée au mot de passe) | 28 | Réussie (dont mise à jour du service worker, session expirée, conflits) |
| `catalogue-lecture.browser.mjs` (adaptée) | 8 | Réussie |
| `modules-management.browser.mjs` | 13 | Réussie (360 → 1440 px) |
| `paper-distribution.browser.mjs` | 7 | Réussie (impression collective, saisie papier, correction par le plein) |
| `ui-sweep.browser.mjs` | 343 affichages (4 profils × 7 largeurs : 320, 375, 390, 430, 768, 1024, 1440) | Aucun débordement, aucune erreur JavaScript, aucun libellé technique |

### Éditeur pédagogique (15)
Module vide ouvert sur Présentation (champs complémentaires repliés) · ajout de deux leçons, la nouvelle s'ouvre · enregistrement automatique confirmé par l'API · bloc « À retenir » · changement de leçon pendant la saisie sans perte · coupure réseau : « Hors connexion », envoi au retour · fermeture hors connexion puis reprise du brouillon local · conflit : version distante intacte, choix explicite · réorganisation Alt + flèche · vérification : point bloquant, « Corriger », suppression confirmée · image : format et taille refusés avant envoi · aperçu : encadré, largeur téléphone · soumission (récapitulatif, conséquences) · corrections demandées : motif affiché puis rappelé pendant la reprise · 360 px.

### Mot de passe unique (17) — correspondance avec les 24 scénarios demandés
| # demandé | Couverture |
| --- | --- |
| 1–2 première connexion, préparation | ✔ connexion + case « Utiliser aussi cet appareil sans connexion » → « Prêt » |
| 3–6 fermeture, coupure, réouverture, même mot de passe | ✔ (navigateur réellement fermé, profil persistant) |
| 7 mot de passe incorrect | ✔ |
| 8 lecture d'un cours téléchargé | ✔ |
| 9 contenu absent | ✔ (refus ou renvoi à l'accueil, aucune page cassée) |
| 10–11 reconnexion, synchronisation | ✔ `offline-first` n° 15, 24, 27 |
| 12 changement de mot de passe (cet appareil) | ✔ nouveau mot de passe aussitôt valable hors connexion |
| 13 réinitialisation | ◐ même mécanisme que 14 (sessions fermées + reprotection à la connexion) ; parcours e-mail/lien non rejoué ici (couvert par `account-recovery.int-spec.ts` côté API) |
| 14 changement depuis un autre appareil | ✔ ancienne session refusée, reconnexion, ancien mot de passe refusé hors ligne, nouveau accepté, données conservées |
| 15 révocation de l'appareil | ✔ détectée au retour du réseau, données illisibles, effacement expliqué |
| 16 deux comptes sur un navigateur | ✔ |
| 17 données locales corrompues | ✔ refus propre, réparation à la connexion suivante |
| 18 préparation interrompue | ✘ non testé (logique « Prêt seulement si complet » inchangée, AUD-008) |
| 19 quota dépassé | ✘ non testé (message existant, non simulé) |
| 20 mise à jour du service worker | ✔ `offline-first` n° 26 |
| 21 déconnexion avec modifications en attente | ◐ conservation vérifiée après session expirée (`offline-first` n° 25, 27) ; déconnexion volontaire non rejouée |
| 22 longue période hors ligne | ◐ règle des 14 jours testée unitairement (`identityAt`, `offline-first.test.ts`), pas en navigateur |
| 23 tentatives incorrectes | ✔ attente imposée après 3 échecs |
| 24 retour en ligne, session expirée | ✔ `offline-first` n° 25 |
| Conversion d'un ancien coffre à phrase | ✔ (ajouté) |
| Aucun mot de passe en clair sur l'appareil | ✔ (IndexedDB et `localStorage` inspectés) |

**Critère impératif** : aucun parcours testé ne demande un second secret ; seule la conversion unique d'un ancien coffre redemande l'ancienne phrase, une fois.

## 3. Captures (non versionnées)
Captures produites dans le répertoire temporaire de session : éditeur à 360 px, conflit d'édition, aperçu téléphone, hors connexion (mauvais mot de passe), appareil retiré, balayage 390/1440 px. Contrôle visuel effectué sur l'éditeur (1280 et 360 px), le conflit, la connexion hors ligne et « Cet appareil ».

## 4. Anomalies trouvées et corrigées pendant la recette
1. Après « Bloc pédagogique », le focus revenait au bouton du menu : la saisie partait dans le menu → focus rendu à l'éditeur.
2. Outil « Annuler » (défaire) homonyme du bouton « Annuler » du panneau image → « Défaire » / « Refaire ».
3. Débordement horizontal à 360 px (colonne implicite de la grille) → `grid-cols-[minmax(0,1fr)]`.
4. Après connexion avec préparation, l'effet « déjà connecté » écrasait la redirection vers « Cet appareil ».
5. Hors connexion, deux champs « Mot de passe » sur la page de connexion → un seul.
6. « Verrouiller » en ligne aussitôt annulé par l'ouverture automatique → verrouillage manuel durable.
7. **Sécurité** : la création d'une leçon avec contenu ne contrôlait pas l'appartenance des images internes au module → corrigé et testé.

## 5. Non exécuté
- Envoi réel vers Cloudflare R2 et lecture d'une image de leçon redirigée vers R2 (stockage simulé) ; CORS `GET` du compartiment à vérifier en préproduction.
- Audit automatique d'accessibilité (axe) : non disponible localement ; contrôles manuels (libellés, rôles `tab`/`status`/`alert`, focus, cibles ≥ 44 px sur les nouveaux composants).
- Largeurs 360 et 1280 px hors éditeur et gestion des modules (le balayage couvre 320–1440 sur 7 largeurs).
- Mesure de performance (poids des pages, bundle de l'éditeur) ; temps d'ouverture PBKDF2 sur téléphone réel.
- Navigateurs autres que Chromium (Safari iOS, Firefox).
