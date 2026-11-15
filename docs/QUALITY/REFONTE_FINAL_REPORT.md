# Rapport final — refonte UX, éditeur pédagogique et mot de passe unique hors connexion

Date : 2026-11-15 · Branche : `feat/refonte-ux-editeur-hors-ligne` (depuis `main` 0084af3), **non poussée, non fusionnée**.

## 1. Résumé

Quatre lots réalisés successivement. Priorités : ne plus perdre de saisie, rédiger simplement, comprendre les retours de correction, et surtout **un seul mot de passe en ligne et hors connexion**. Aucune règle pédagogique, permission ou étape du workflow de publication n'a été modifiée ; le serveur reste l'autorité.

## 2. Modifications par lot

| Lot | Statut | Contenu |
| --- | --- | --- |
| 1 Éditeur | Implémenté et testé | Sections libres (Présentation, Contenu, Vérification, Soumission, Historique) ; espace de rédaction à deux zones (panneau sur mobile) ; enregistrement automatique avec brouillon local, hors connexion, reprise, conflits explicites ; blocs pédagogiques ; image depuis l'appareil (contrôles, description obligatoire) ; vérification avant envoi ; aperçu ordinateur/téléphone. D178, D179. |
| 2 Publication, évaluations | Partiellement implémenté, testé | Retour de correction mutualisé (modules et questionnaires) et rappelé pendant la reprise ; « Envoyer pour validation » avec récapitulatif pour les questionnaires ; libellés clarifiés. Éditeur de questions, lecture routier et impression audités, non modifiés (pas de défaut bloquant) ; impression vérifiée par la recette papier. |
| 3 UX globale, hors connexion | Mot de passe unique : implémenté et testé. UX globale : partiellement | Coffre format 3, clé d'appareil serveur, ouverture automatique en ligne, reprotection après changement ou réinitialisation, retrait d'appareil, conversion des anciens coffres, verrouillage d'inactivité, connexion hors ligne à un seul champ ; notifications harmonisées. Tableaux de bord, navigation et design system : audités (balayage sans défaut), non refondus. D180. |
| 4 Stabilisation | Réalisé | Suites complètes, 7 recettes navigateur, balayage responsive, revue de sécurité (1 faille corrigée), documentation. |

## 3. Fichiers principaux

- Partagé : `packages/shared/src/lesson-content.ts` (images internes, `PEDAGOGICAL_BLOCKS`), `offline.ts` (appareils).
- API : `pedagogy/module-editor.service.ts` (contrôle des images), `module-files.service.ts` (lecture des images de leçons publiées), `module-pdf.ts` ; `users/offline-devices.{service,controller}.ts` ; `prisma/schema.prisma`, migration `20261118090000_offline_devices`.
- Web : `encadrement/modules/[id]/modifier/{module-editor,lessons-panel}.tsx`, `components/modules/{lesson-editor,use-lesson-autosave,correction-notice,lesson-structure,lesson-content,module-metadata-form}.tsx`, `lib/{lesson-drafts,module-readiness}.ts`, `lib/api/assets.ts` ; `lib/offline/{vault,vault-crypto,downloads}.ts`, `components/offline/{device-panel,device-setup,device-unlock}.tsx`, `app/connexion/login-form.tsx`, `components/accounts/account-settings.tsx`, `components/offline-runtime.tsx`, `components/ui/toaster.tsx`, éditeur et préparation d'évaluation.
- Tests : `module-contracts.spec.ts`, `module-files.int-spec.ts`, `offline-devices.int-spec.ts`, `vault-crypto.test.ts`, `module-readiness.test.ts`, `lesson-drafts.test.ts`, recettes `editeur-pedagogique` et `offline-auth` (nouvelles), `offline-first` et `catalogue-lecture` (adaptées).
- Docs : `docs/audits/UX_GLOBAL_AUDIT.md`, `docs/architecture/EDITOR_UX.md`, `docs/architecture/OFFLINE_AUTH.md`, `docs/QUALITY/UX_ACCEPTANCE_TESTS.md`, ce rapport, `OFFLINE_FIRST.md`, `DECISIONS.md` (D178–D180), `CHANGELOG.md`. Les documents « quality » sont rangés dans `docs/QUALITY/`, dossier existant du dépôt.

## 4. Migrations

`20261118090000_offline_devices` : création de table + index + clé étrangère + contrainte de longueur. **Additive**, aucune donnée existante touchée. Appliquée **uniquement sur `tesla_test`** (préparation des tests). Non appliquée sur la base de développement `tesla` ni en production.

## 5. Tests

Voir `UX_ACCEPTANCE_TESTS.md` : lint et types OK ; 287 + 112 tests unitaires ; 183 tests d'intégration (1 ignoré préexistant) ; build OK ; recettes navigateur 15 + 17 + 28 + 8 + 13 + 7 contrôles et 343 affichages de balayage, toutes réussies.

## 6. Risques et limites

- **Vol d'appareil** : coffre exposé à une attaque par dictionnaire hors ligne contre un mot de passe faible ; la limitation des essais dans l'interface ne protège pas une copie des fichiers. Pendant un déverrouillage (≤ 12 h, 2 h d'inactivité), la clé figure dans le stockage du navigateur.
- Un appareil isolé ignore un changement de mot de passe ou un retrait jusqu'à sa reconnexion (borne : 14 jours d'identité locale).
- R2 réel non testé ; CORS `GET` du compartiment requis pour télécharger hors ligne les images de leçon stockées.
- Brouillons de leçons dans `localStorage` (contenu pédagogique, sans donnée personnelle) conservés jusqu'à confirmation, même après déconnexion.
- Blocs pédagogiques à fin implicite (titre suivant).
- Durées (2 h, 12 h, 14 jours) à valider par le responsable.
- Recette `offline-auth` : un passage interrompu à la reconnexion n'a pas été reproduit (2 passages complets ensuite) : à surveiller en CI.

## 7. Reste à faire (recommandations)

1. Valider D178–D180 et les durées avec le responsable plein.
2. Préproduction : appliquer la migration, tester l'envoi R2 et la lecture d'une image de leçon (routier, après publication), CORS `GET`, temps d'ouverture du coffre sur téléphone d'entrée de gamme, Safari iOS.
3. Ajouter `offline-auth` et `editeur-pedagogique` au job `browser` de la CI.
4. Reporter les erreurs de validation de l'API sur les champs (pratique INMI), `loading.tsx`/`error.tsx` par groupe de routes, DataTable accessible (VDM Live).
5. Éditeur de questions d'évaluation en deux zones avec enregistrement automatique (même modèle que les leçons).
6. Audit axe automatisé et mesure du poids de l'éditeur Tiptap.

## 8. Commits

`dac143b` éditeur (lot 1) · `63001d2` corrections et envoi (lot 2) · `58a8c91` API appareils · `886afac` mot de passe unique · `97c0781` notifications · `9388404` correctif de sécurité · commit de documentation (lot 4).

## 9. Avant déploiement

Autorisation explicite requise pour : push, fusion dans `main`, migration en préproduction puis production (`prisma migrate deploy`), déploiement Vercel (web) et OVH (API). Le web et l'API doivent être déployés **ensemble** (le web appelle `/auth/offline-devices`). Prévenir les utilisateurs : à la première connexion après la mise à jour, un appareil préparé avec une phrase propose une conversion unique.
