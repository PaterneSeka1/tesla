---
paths:
  - "apps/api/src/modules/pedagogy/**"
  - "apps/api/src/modules/progression/**"
  - "apps/api/src/modules/programmes/**"
  - "apps/web/src/app/(espaces)/**"
  - "packages/shared/src/progression.ts"
  - "docs/BUSINESS_RULES.md"
---
# Règles pédagogiques (non négociables sans décision du responsable)

1. **Consultation libre** des modules **publiés** par tous les routiers authentifiés. Un brouillon n'est jamais visible des routiers.
2. **Publication exclusivement après approbation** du responsable pédagogique. Un chef crée et modifie ; il soumet ; seul le responsable approuve ou renvoie avec motif. Toute modification d'un module publié repasse par l'approbation.
3. **Évaluations contrôlées** : accessibles selon l'étape de progression du routier.
4. **Exceptions individuelles** : seul le responsable accorde un déblocage, nominatif, motivé, tracé dans l'audit, révocable.
5. **Validation officielle exclusivement humaine** : un score d'évaluation n'entraîne jamais de validation ni de passage d'étape automatique. Seul le responsable valide.
6. **Respect des référentiels** : étapes Noviciat → Apprentissage → Compagnonnage → Départ routier (SAPF-Route) et programme annuel 2026–2027 de la communauté.
7. **Aucune génération automatique de règles** : durées d'étape (variables selon l'âge), seuils de réussite, conditions de cérémonie restent **configurables** et **à arbitrer**. Ne jamais coder une valeur non validée ; la signaler dans `docs/DECISIONS.md`.
8. **Routiers sans compte** : un routier sans compte est suivi exactement comme les autres (inscription, équipe, formation imprimée, quiz papier, observations, résultats, validation). Les règles d'éligibilité s'appliquent à l'identique.
9. **Formation papier** : la feuille nominative porte le code de tentative, l'identité, le matricule, l'équipe à la date de préparation et les questions de la **version publiée choisie** ; jamais le corrigé. La tentative conserve cette version même si une nouvelle version est publiée.
10. **Éligibilité papier** : le backend vérifie routier, version publiée, étape courante ou dérogation active du responsable avant de préparer la tentative. La possibilité de répondre sur papier ne contourne jamais la progression.
11. **Trois niveaux distincts** : correction du questionnaire (chef ou responsable) → décision pédagogique sur le résultat (`VALIDEE`/`REFUSEE`, responsable) → validation officielle d'un acquis ou d'une étape (responsable, acte séparé, jamais automatique).
12. Le chef accompagne, il ne surveille pas : pas de classement entre routiers, pas de score arbitraire affiché comme jugement.
