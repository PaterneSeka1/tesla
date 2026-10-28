# Règles d'usage de l'IA pendant le développement

## Agent et délégation
- Un agent principal par défaut. Pas de sous-agent pour une tâche faisable en quelques appels.
- Délégation seulement si le bénéfice est identifiable (recherche large, travail parallèle indépendant). Jamais deux agents sur les mêmes fichiers.

## Lecture ciblée
- Commencer par `docs/IMPLEMENTATION_STATUS.md`, puis le module concerné et la règle `.claude/rules/` pertinente.
- Ne pas relire tout le dépôt. Rechercher (`grep`) avant d'ouvrir. Ne citer que les lignes utiles d'un gros fichier.

## Génération
- Réutiliser composants, schémas Zod et services existants.
- Interdits : composants inutilisés, abstractions prématurées, variantes multiples d'une même fonctionnalité, documentation dupliquée, refactorisation non demandée, simulation présentée comme réelle.

## Outils déterministes d'abord
- Préférer `tsc`, ESLint, Vitest, Prisma, Git aux raisonnements longs. Lire les journaux d'erreur avant de relancer ; ne pas répéter une commande en échec sans changement.

## Données et coûts
- Aucun secret, `.env`, donnée personnelle réelle dans les prompts, la doc ou le code.
- Aucun service externe payant sans autorisation. Ne pas présumer que les appels IA sont gratuits.
- Ne rapporter des chiffres de tokens/coût que s'ils sont fournis par l'outil.

## Documentation
- À la fin de chaque phase : mettre à jour `docs/IMPLEMENTATION_STATUS.md`, `docs/DECISIONS.md` si un choix est fait, `CHANGELOG.md` si notable.
