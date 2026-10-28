# Règles métier

> Statut : règles **documentées**, non encore implémentées (sauf mention). Source : cahier de la mission, document SAPF-Route (Atelier pédagogique Branche Route), programme annuel 2026–2027 de la Communauté Nikola Tesla.

## Périmètre
- Une communauté (Nikola Tesla), une branche (Route), année scoute 2026–2027.
- Environ 25 routiers, 4 chefs, 1 responsable pédagogique principal.

## Rôles et permissions

| Action | Routier | Chef | Responsable |
| --- | :---: | :---: | :---: |
| Consulter les modules publiés | ✅ | ✅ | ✅ |
| Télécharger un module pour lecture hors ligne | ✅ | ✅ | ✅ |
| Créer / modifier un module (brouillon) | — | ✅ | ✅ |
| Soumettre un module à l'approbation | — | ✅ | ✅ |
| Approuver ou renvoyer un module (publication) | — | — | ✅ |
| Passer une évaluation accessible | ✅ | — | — |
| Accorder / révoquer un déblocage individuel | — | — | ✅ |
| Valider officiellement un acquis | — | — | ✅ |
| Consulter sa propre progression | ✅ | — | — |
| Consulter la progression des routiers | — | ✅ | ✅ |
| Gérer les comptes | — | — | ✅ (à confirmer) |

Toutes les permissions sont vérifiées côté serveur.

## Règles

1. **Publication** : un module n'est visible des routiers qu'une fois **approuvé** par le responsable. Cycle prévu : `BROUILLON → SOUMIS → PUBLIÉ` (ou `SOUMIS → À_REVOIR` avec motif). Toute modification d'un module publié crée une nouvelle version soumise à approbation.
2. **Consultation libre** des modules publiés, sans condition de progression.
3. **Évaluations contrôlées** : accessibles selon l'étape de progression du routier.
4. **Déblocage individuel** : exception nominative accordée par le responsable, motivée, tracée, révocable.
5. **Validation des acquis** : exclusivement humaine, par le responsable. Un résultat d'évaluation est une information, jamais une décision automatique.
6. **Audit** : approbations, déblocages, validations et changements d'étape sont journalisés (`AuditLog`).

## Référentiel de progression (SAPF-Route)

| Étape | Libellé du programme | Signe de fin d'étape |
| --- | --- | --- |
| Noviciat | Novices Routiers | Flot gris |
| Apprentissage | Aspirants Routiers | Flot marron |
| Compagnonnage | Compagnons Routiers | Flot routier |
| Départ routier | Routiers Confirmés | Étoile or |

Ces étapes sont chargées par le seed (`progression_stages`) depuis `@tesla/shared`.

## Points en attente d'arbitrage (ne pas coder de valeur définitive)
- **Durées d'étape** : le document SAPF donne des durées narratives (1, 6, 10 mois, une année) et un tableau synoptique qui les module selon l'âge (18/19/20 ans). Lequel fait foi ?
- Conditions d'accès précises aux évaluations par étape et seuils de réussite.
- Rôle des chefs dans la consultation des résultats individuels.
- Qui gère les comptes (responsable ou administrateur technique distinct).
- Durée de conservation des données et des résultats.
