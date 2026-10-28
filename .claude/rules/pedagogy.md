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
8. Le chef accompagne, il ne surveille pas : pas de classement entre routiers, pas de score arbitraire affiché comme jugement.
