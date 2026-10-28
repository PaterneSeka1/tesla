# Gouvernance de l'IA

## Dans l'application
- **Aucune** API ou modèle d'intelligence artificielle n'est intégré. L'application fonctionne entièrement sans IA.
- Aucune règle pédagogique, validation ou décision n'est générée automatiquement.
- Toute intégration future d'IA nécessite une décision écrite (`docs/DECISIONS.md`) et l'accord du responsable.

## Pendant le développement (Claude Code, Codex…)

| Principe | Application |
| --- | --- |
| Un agent principal | Sous-agents uniquement si le bénéfice est identifiable ; jamais deux agents sur les mêmes fichiers |
| Lecture ciblée | `docs/IMPLEMENTATION_STATUS.md` d'abord, puis le module concerné ; règles `.claude/rules/` chargées selon les chemins |
| Pas de génération inutile | Pas de composants inutilisés, d'abstraction prématurée, de refactorisation non demandée, de doublon de documentation |
| Outils déterministes | `tsc`, ESLint, Vitest, Prisma, Git avant tout raisonnement long ; lire les journaux avant de relancer |
| Données | Aucun secret, `.env` ou donnée personnelle réelle transmis aux outils ou écrits dans la doc |
| Coûts | Aucun service payant sans autorisation ; les appels IA ne sont pas présumés gratuits |
| Mémoire du projet | `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`, `CHANGELOG.md` mis à jour à chaque phase pour éviter les réanalyses |

## Limites de cette politique
- Ces règles sont des **instructions**, pas des limites techniques : un fichier Markdown n'impose aucun plafond de consommation. Un plafond réel se configure dans les paramètres de facturation ou de l'organisation du fournisseur.
- Les statistiques de tokens ou de coût ne sont rapportées que si l'outil les fournit ; sinon, elles sont déclarées « non disponibles ».
