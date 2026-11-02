# Bilan de préparation à la production

## Bilan du 2026-11-02 (consolidation, branche `chore/tesla-production-hardening`)

Anomalies et matrice de gouvernance : [PRODUCTION_AUDIT.md § 5](PRODUCTION_AUDIT.md#5-audit-de-consolidation-du-2026-11-02). Guide d'installation : [DEPLOYMENT.md](DEPLOYMENT.md). Les sections suivantes (2026-10-30) restent valables sauf mention contraire ci-dessous.

### Contrôles exécutés (2026-11-02, commit `c7d0c3f` puis documentation)

| Contrôle | Résultat |
| --- | --- |
| `npm ci`, `format:check`, `lint`, `typecheck`, `build` | Réussis |
| `npm run test` | API 187, web 72 : réussis |
| `npm run test:int -w @tesla/api` (PostgreSQL 18, `tesla_test`) | 129 tests, 13 fichiers : réussis (une régression trouvée en cours de route sur `pedagogy:release`, corrigée) |
| `npm run audit:prod` | 558 paquets, 0 vulnérabilité bloquante (1 modérée, outillage) |
| Recettes Chromium (production locale) | Offline-first 28/28 et comptes 9/9 à 320, 390 et 1280 px ; balayage 434 affichages (4 profils, 7 largeurs) sans défaut |
| Exploitation | shellcheck sans avertissement ; sauvegarde/restauration 9/9 ; `nginx -t` nginx 1.24 (deux instances) ; `systemd-analyze verify` sans erreur de syntaxe ; configuration générée par `bootstrap.sh` acceptée par `validateEnv` |

**Non exécutés** (aucun accès) : workflow GitHub Actions, VPS OVH et `bootstrap.sh` sur Ubuntu réel, Let's Encrypt, Cloudflare R2 réel (envoi, `If-None-Match`, CORS, verrou, `rclone` vers R2), téléphones réels (Chrome Android, Safari iOS), Firefox, lecteurs d'écran, test de charge, exercice chronométré de restauration.

### État des exigences modifiées

| Exigence | État |
| --- | --- |
| Fin de fonction de l'encadrement immédiate | IV (mandats supprimés, `endedAt` horodaté) |
| Phrase oubliée, plusieurs onglets, éviction, échéance hors ligne | IV par recette générale ; pas de test automatisé dédié |
| Rattrapage limité aux modules encore obligatoires | IV (test d'intégration) |
| Points « à vérifier » acquittés avant approbation | IV (tests d'intégration) |
| Installation serveur reproductible, alertes, retour arrière sûr | INV (vérifié localement, jamais sur serveur) |
| Envoi d'e-mails | NI par choix (D150) : liens transmis par la personne habilitée, `create-admin --recover` |
| Rotation de `MEDICAL_DATA_KEY` | NI (AUD-055) |
| CSP de scripts à nonces | NI (AUD-038) |

### Contenu et gouvernance constatés sur la base locale `tesla`
36 modules importés, **tous en brouillon**, 29 leçons vides, 36 modules portant des points à vérifier ou à compléter, **aucun questionnaire**, **aucun responsable plein désigné**, un référentiel d'âge en vigueur (Noviciat seulement). Rien n'a été publié ni inventé : c'est un travail de relecture et de décision humaine.

### Décision

**GO — PRÉPRODUCTION UNIQUEMENT.**

Aucun test exécuté n'échoue et aucun blocage logiciel connu n'empêche l'installation. Mais le code n'a jamais tourné sur un VPS, ni avec R2 réel, ni sur un téléphone, et la CI n'a pas pu être consultée. Passage à `GO — PRÊT POUR DÉPLOIEMENT OVH` lorsque, en préproduction :
1. CI verte sur GitHub (quatre jobs) ;
2. `bootstrap.sh` puis `deploy.sh` réussis sur un VPS Ubuntu 24.04, contrôles de [DEPLOYMENT.md](DEPLOYMENT.md) § 3 étape 8 réussis, alerte d'essai reçue ;
3. parcours R2 réels ([STORAGE_R2.md](STORAGE_R2.md) § 13) et sauvegarde copiée puis restaurée depuis R2, durée mesurée ;
4. recette Chrome Android et Safari iOS ([TEST_PLAN.md](TEST_PLAN.md) § 4) ;
5. décisions bloquantes tranchées ou explicitement reportées (PRODUCTION_AUDIT § 4 et § 5.5), responsable plein désigné, contenu relu.

Si l'un échoue : **NO-GO**.

---

## Historique : bilan du 2026-10-30

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

### Fiches médicales (2026-10-30, D135–D137)

| Exigence | État | Preuve |
| --- | --- | --- |
| Fiche par compte, titulaire seul, chiffrée, audit sans contenu, PDF `no-store`, hors cache | IV | `medical-records.int-spec.ts` (12), `medical.spec.ts` (7) |
| Clé `MEDICAL_DATA_KEY` générée, déployée et **sauvegardée hors des sauvegardes de base** | INV | À faire au déploiement ; l'API refuse de démarrer en production sans clé |
| Durée de conservation, organisation des secours, base légale | BD | À valider par la communauté (MEDICAL_RECORDS.md) |
| Rendu visuel du PDF et impression réelle | INV | Texte et format A4 contrôlés automatiquement seulement |

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
