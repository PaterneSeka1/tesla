# Bilan de préparation à la production

État au 2026-10-30, branche `chore/preparation-production` (non poussée, non fusionnée). Anomalies : [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md).

Légende : **IV** implémentée et vérifiée · **INV** implémentée, non vérifiée · **P** partielle · **BD** bloquée par une décision métier · **NI** non implémentée.

## 1. Exigences

### Comptes et authentification

| Exigence | État | Preuve |
| --- | --- | --- |
| Création de comptes par les personnes habilitées | IV | `accounts.int-spec.ts`, recette comptes |
| Activation sécurisée, mot de passe initial | IV | Idem |
| Réinitialisation du mot de passe | IV | Idem (lien de réinitialisation, ancien mot de passe refusé) |
| Changement de mot de passe par l'utilisateur | IV | Idem |
| Désactivation, réactivation | IV | Idem |
| Révocation de sessions (personnelle et par un habilité) | IV | Idem |
| Consultation des sessions actives | IV | Idem |
| Profil personnel | IV | Idem (nom affiché) |
| Rattachement d'un compte à un routier existant ; routier sans compte | IV | Idem + tests existants |
| Historisation des opérations sensibles | IV | Journal d'audit vérifié dans les tests |
| Premier administrateur sans mot de passe codé | IV | `create-admin.js` exécuté sur `tesla_test` ; second refusé |
| Limitation persistante des tentatives | IV | Test d'intégration |
| Envoi des liens par e-mail | NI | Aucun service d'e-mail (choix : transmission par la personne habilitée) |
| Changement de rôle d'accès d'un compte | NI | Non prévu ; à décider |

### Progression et gouvernance

| Exigence | État | Preuve |
| --- | --- | --- |
| Étape théorique par l'âge, distincte de l'étape officielle | IV | `refonte.int-spec.ts` |
| Noviciat à 18 ans, un mois | IV | Référentiel `2026.1` |
| Durées Apprentissage/Compagnonnage, délais de rattrapage, Départ routier, obligations par étape | BD | Valeurs nulles, signalées ; manuel SAPF-Route absent |
| Rattrapages, décision humaine | IV | Tests existants |
| Sortie le jour du 21e anniversaire, sans suppression | IV | Tests existants |
| Annulation d'une sortie erronée | BD | AUD-015 |
| Aucune décision officielle automatique | IV | Revue + tests (score sans effet sur l'étape) |
| Un seul plein à une date, reconduction explicite illimitée, fin anticipée, délégations | IV | `refonte.int-spec.ts` (contraintes PostgreSQL) |
| Perte immédiate des permissions côté serveur | P | Recalcul à chaque requête (IV) ; délégation liée au mandat du délégataire (IV) ; fin anticipée le jour même effective le lendemain (AUD-013) |
| Autorité de nomination, droits de l'adjoint | BD | D101, D103 |

### Offline-first

| Exigence | État | Preuve |
| --- | --- | --- |
| Une seule application avec ou sans réseau | IV | Recette 28/28 (390 et 1280 px) |
| Consultation des pages préparées | IV | Recette (Chromium) |
| Page non préparée expliquée | IV | `/hors-ligne` |
| Écritures différées traçables et idempotentes | IV | `offline-sync.int-spec.ts`, recette |
| Jamais « enregistré » avant confirmation du serveur ; jamais de suppression silencieuse | IV | Revue + recette |
| Isolation entre comptes sur appareil partagé | P | Correction AUD-002 ; scénario d'expiration puis autre compte non automatisé |
| Migrations du stockage IndexedDB | NI | AUD-021 |
| Phrase oubliée, éviction du stockage, plusieurs onglets | NI | AUD-019, AUD-023, AUD-020 |
| Chrome Android, Safari iOS, Firefox | NI (non exécuté) | Procédure : [TEST_PLAN.md](TEST_PLAN.md) § 4 |

### Sécurité, qualité, exploitation

| Exigence | État | Preuve |
| --- | --- | --- |
| Autorisation serveur, CSRF, CORS, cookies, en-têtes | IV | [SECURITY_AUDIT.md](SECURITY_AUDIT.md) |
| Dépendances sans vulnérabilité connue | IV | `audit:prod` (532 paquets) |
| CI complète (intégration, migrations, recettes, audit) | INV | Workflow écrit, jamais exécuté sur GitHub |
| Fichiers Nginx, systemd, scripts | INV | Non chargés sur un serveur ; `nginx -t` non exécuté |
| Sauvegarde chiffrée, restauration d'essai, restauration | IV (local) | Testés sur `tesla_test` ; copie hors site non testée |
| RPO/RTO | BD | Propositions à valider |
| Préproduction distincte | INV | Instance `preproduction` prévue, non installée |

## 2. Contrôles exécutés en fin de travaux (2026-10-30)

| Contrôle | Résultat |
| --- | --- |
| `npm run format:check`, `lint`, `typecheck`, `build` | Réussis |
| `npm run test` | API 144 (18 fichiers), web 74 (5 fichiers) : réussis |
| `npm run test:int -w @tesla/api` (`tesla_test`) | 94 tests (9 fichiers) : réussis |
| Dérive migrations ↔ schéma (`tesla_test`) | Aucune |
| `npm run audit:prod` | 532 paquets, 0 vulnérabilité |
| Recette offline-first (Chromium headless, production locale) | 28/28 à 390 px et à 1280 px |
| Recette comptes (Chromium headless, production locale) | 9/9 à 390 px et à 1280 px |
| Sauvegarde / restauration (`tesla_test`) | Réussies, altération et écrasement refusés |

Non exécutés : workflow GitHub Actions, déploiement et unités systemd sur VPS, `nginx -t`, Certbot, rclone, appareils réels (Android, iOS), Firefox, Safari, lecteurs d'écran, test de charge.

## 3. Décision

**GO PILOTE UNIQUEMENT.**

Le pilote s'entend : préproduction puis une instance restreinte, communauté Nikola Tesla seule, nombre de comptes limité, avec retour arrière possible. Il ne peut ouvrir que lorsque ces contrôles, impossibles dans l'environnement local, sont faits et réussis :

1. CI verte sur GitHub (trois jobs) ;
2. installation en préproduction selon [DEPLOYMENT.md](DEPLOYMENT.md), `nginx -t`, TLS, pare-feu, PostgreSQL non joignable de l'extérieur ;
3. sauvegarde copiée hors site, puis restauration vérifiée depuis cette copie ;
4. recette manuelle Chrome Android et Safari iOS ([TEST_PLAN.md](TEST_PLAN.md) § 4, scénarios 1 à 9) ;
5. premier administrateur, année scoute et responsable plein consignés.

Si l'un de ces points échoue : **NO-GO**.

La production générale est **NO-GO** à ce jour :
- règles pédagogiques bloquantes non tranchées (§ 1, BD) : aucune obligation de rattrapage ni étape au-delà du Noviciat ne peut être calculée ;
- aucun contenu publié : 8 leçons vides, aucun questionnaire ;
- P1 ouverts : AUD-013 (fin de mandat le jour même), AUD-014 (référentiel d'âge) ;
- P2 offline ouverts : AUD-019 à AUD-024 ;
- RPO/RTO non validés ; exercice de restauration non chronométré.

Un build réussi ne vaut pas mise en production : cette décision repose sur les contrôles du § 2 et sur ceux qui restent à faire.
