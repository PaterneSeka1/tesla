# Phase 1 — Registre des routiers et équipes

Statut : **schéma et migration proposés sur branche de développement ; tests et application sur une base réelle non exécutés**.

- Un routier peut exister sans compte : `ScoutProfile.userId` est facultatif et unique lorsqu'il existe.
- Identité de référence : `ScoutProfile.firstName`, `lastName`, `matricule` (facultatif et unique), `isActive`.
- `Team` représente une équipe ; `TeamAssignment` conserve les affectations dans le temps.
- Contrainte PostgreSQL partielle `team_assignments_one_active_per_scout` : une seule affectation active par routier.
- Les données des comptes existants sont reprises dans les nouveaux champs de nom avant le passage en NOT NULL.
- La publication des cours, l'impression, les quiz papier et les codes de tentative ne sont **pas encore développés**.

## Suite immédiate

1. Exécuter `npm run db:generate` et `npm run db:deploy` sur une **base locale de développement** sauvegardée.
2. Exécuter `npm run typecheck`, `npm run lint` et les tests ; corriger toute erreur observée.
3. Implémenter authentification et contrôle d'accès côté API avant toute exposition de données personnelles.
4. Construire les services CRUD équipe/routier et les tests d'affectation transactionnelle.
5. Ajouter ensuite modèle d'évaluation, compteur de code unique et génération de feuilles A4.

Ne pas fusionner cette branche avant validation locale de la migration.
