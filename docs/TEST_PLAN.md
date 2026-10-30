# Plan de tests

## 1. Niveaux automatisés

| Niveau | Commande | Contenu | CI |
| --- | --- | --- | --- |
| Unitaires API | `npm run test -w @tesla/api` | Contrats Zod, moteur d'âge, correction objective, éligibilité, permissions, CSRF, en-têtes | `quality` |
| Unitaires web | `npm run test -w @tesla/web` | Navigation et accès par chemin, client API (lectures strictes), dépôt local, identité hors ligne, file d'opérations | `quality` |
| Intégration | `npm run test:int -w @tesla/api` (`TEST_DATABASE_URL` vers une base `*_test`) | PostgreSQL réel : contraintes, triggers, concurrence, permissions HTTP, comptes, mandats, offline | `integration` |
| Migrations | `prisma migrate deploy` sur base vide + `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | Toutes les migrations s'appliquent ; aucune dérive | `integration` |
| Recette offline-first | `apps/web/test/offline-first.browser.mjs` | 28 contrôles, Chromium réel, profil persistant, coupure réseau complète | `browser` (390 px) |
| Recette comptes | `apps/web/test/accounts.browser.mjs` | Installation, activation, gestion, compte personnel (9 contrôles) | `browser` |
| Dépendances | `npm run audit:prod` | Vulnérabilités connues (gravité ≥ high bloquante) | `quality` |

La CI échoue si l'une de ces étapes échoue. **Le workflow n'a pas encore été exécuté sur GitHub** (branche non poussée).

## 2. Couverture des parcours critiques

| Parcours | Test |
| --- | --- |
| Routier sans compte, compte créé et rattaché plus tard | `accounts.int-spec.ts` « routier sans compte… » ; `scouts-evaluations.int-spec.ts` |
| Activation, réinitialisation, lien unique/expiré/remplacé | `accounts.int-spec.ts` ; recette comptes |
| Désactivation (sessions révoquées immédiatement), réactivation, dernier administrateur | `accounts.int-spec.ts` |
| Limitation des tentatives persistante | `accounts.int-spec.ts` |
| Périmètres des comptes (plein → routiers seulement, encadrement et routier refusés) | `accounts.int-spec.ts` |
| Détermination du parcours (âge, étape théorique ≠ officielle) | `refonte.int-spec.ts`, `age-progression.spec.ts` |
| Rattrapage (création idempotente, décision humaine) | `refonte.int-spec.ts` |
| Sortie à 21 ans (veille/jour, idempotence, historique) | `refonte.int-spec.ts` |
| Publication d'un module (soumission, approbation, refus au chef) | `modules.int-spec.ts` |
| Passation, correction, validation humaine, étape inchangée | `evaluations.int-spec.ts`, `scouts-evaluations.int-spec.ts` |
| Mandats (un seul plein, reconductions, fin anticipée, délégations) | `refonte.int-spec.ts`, `accounts.int-spec.ts` (délégation et mandat du délégataire) |
| Révocation de permission (fin de mandat, délégation révoquée) | `refonte.int-spec.ts`, `offline-sync.int-spec.ts` |
| Synchronisation après coupure, rejeu sans doublon | `offline-sync.int-spec.ts` ; recette offline-first |
| Détection et résolution de conflit | `offline-sync.int-spec.ts` ; recette offline-first (contrôles 22–23) |

## 3. Lacunes connues (tests à écrire)

- Expiration de session puis connexion d'un autre compte sur le même appareil (AUD-002) : recette dédiée.
- Fusion d'une opération après un envoi interrompu (AUD-009) : test unitaire avec IndexedDB simulé (`fake-indexeddb`, non installé).
- Refus d'une date de référence future par `jobs:daily` (AUD-015).
- `POST /age-rules` et `/activate` en HTTP : rétroactivité, chevauchements, délégataire (AUD-014).
- Refus `SORTI_BRANCHE` de bout en bout (en ligne et papier).
- Fin anticipée de mandat le jour même (AUD-013).
- Quota de stockage dépassé, éviction du stockage, phrase oubliée, plusieurs onglets synchronisant ensemble.

## 4. Recette manuelle sur appareils réels (non exécutée)

Environnement : préproduction HTTPS, comptes fictifs, aucune donnée réelle.

| Navigateur / appareil | Scénarios |
| --- | --- |
| Chrome Android (appareil d'entrée de gamme) | Tous |
| Safari iOS (iPhone récent et ancien) | Tous ; attention : stockage purgé après 7 jours sans visite d'un site non installé — installer la PWA |
| Firefox (Android et ordinateur) | 1–8, 11, 14 |
| Edge / Chrome ordinateur | 1–6 |

Scénarios (consigner : appareil, version, résultat, capture) :

1. Activation par lien reçu par messagerie, connexion, « Mon compte ».
2. Préparation de l'appareil, puis mode avion : tableau de bord, bibliothèque, leçon, progression, évaluations préparées, fiches, équipes, activités, présences, mandats.
3. Page non préparée sans réseau : explication claire (`/hors-ligne`), jamais d'écran cassé.
4. Saisie de présences, observation, fiche, activité hors ligne ; libellé « Enregistré sur cet appareil », jamais « validé ».
5. Coupure pendant une écriture ; pendant un téléchargement de module.
6. Fermeture du navigateur, redémarrage du téléphone, réouverture hors ligne.
7. Deux onglets ouverts ; saisie dans chacun.
8. Changement de compte sur le même appareil ; vérifier qu'aucune donnée du premier compte n'est visible.
9. Session expirée (12 h) puis reconnexion ; synchronisation.
10. Fin de mandat pendant que l'appareil est hors ligne ; retour du réseau : écritures refusées et motivées.
11. Stockage presque plein (Android : remplir le stockage) : préparation « incomplète », jamais « Prêt ».
12. Conflit entre deux appareils sur la même feuille de présence.
13. Mise à jour de l'application avec des opérations en attente.
14. Effacement des données du site par l'utilisateur : comportement et message.
15. Retour du réseau après 3 jours, puis après 15 jours (identité locale expirée).
16. Évaluation hors ligne : préparation, passation, remise, synchronisation ; réservation expirée (> 24 h).
17. Accessibilité : navigation au clavier (ordinateur), lecteur d'écran (TalkBack, VoiceOver) sur connexion, activation et tableau de bord.
