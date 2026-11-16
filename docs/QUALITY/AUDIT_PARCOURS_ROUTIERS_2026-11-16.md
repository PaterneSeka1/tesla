# Audit du parcours de progression des routiers — 2026-11-16 (D181)

## 1. Cause exacte du « Sans étape »

L'étape n'est jamais stockée : elle est calculée à chaque lecture à partir de la **date de naissance** et du **référentiel d'âge en vigueur** (D173, `computed-stage.ts`). « Sans étape » (statistiques) / « Non déterminée » (liste) s'affichait quand ce calcul renvoyait `null` :

1. **Date de naissance absente** : l'inscription l'acceptait (« pré-inscription incomplète », `createScoutProfileInputSchema.birthDate` facultatif) et une correction pouvait la retirer. Cause principale.
2. **Référentiel incomplet** : `2026.1` ne couvre que le noviciat ; tout routier de plus de 18 ans + 1 mois n'avait pas d'étape tant que `2026.2` n'était pas appliqué.
3. **Âge hors branche** : une date donnant moins de 18 ans était acceptée.

Relevé en lecture seule de la base de développement `tesla` (2026-11-16) : **21 routiers actifs, 21 sans date de naissance** ; seul `2026.1` en vigueur (`2026.2` jamais appliqué sur cette base). Aucune donnée personnelle extraite.

## 2. Autres constats

| Constat | Situation avant | Traitement (D181) |
| --- | --- | --- |
| Anciens routiers | Aucune reconnaissance d'étape antérieure : un routier arrivé à 20 ans devait rattraper Noviciat, Apprentissage et Compagnonnage, cours fermés pendant 3 × 21 jours | Table `prior_stage_recognitions`, reconnaissance par le plein, rattrapages de l'étape levés sans acquis fabriqué |
| Lecture des cours | Libre sauf rattrapage (D177 : catalogue, leçons, impression, PDF, hors ligne, fichiers fermés) | Lecture toujours libre ; verrou limité aux évaluations et déclarations d'étude |
| Notions confondues | Frise du routier dérivée de l'âge seul (`Stepper`), aucune distinction reconnue / période écoulée | Frise `timeline` serveur, indicateurs séparés |
| Plusieurs étapes actives | Impossible (calcul + exclusion SQL des exceptions) | Inchangé |
| Concurrence | Fiche verrouillée en correction | Reconnaissance : verrou de fiche, index unique partiel, `expectedUpdatedAt` |
| Hors ligne | Inscription différable | Inscription avec parcours antérieur et reconnaissances : en ligne seulement (décision officielle) |

## 3. Stratégie de migration progressive

1. Diagnostic : `npm run diagnose:stages -w @tesla/api` (lecture seule, code 2 si anomalies).
2. Préparation : migration additive `20261119090000_prior_stage_recognitions` (table, trigger d'historique, trigger interdisant de retirer la date de naissance d'un profil actif). Aucune donnée modifiée.
3. Résolution humaine : appliquer `2026.2` (`db:seed`), compléter les dates de naissance (administrateur ou plein), reconnaître les parcours antérieurs.
4. Renforcement : contrainte `NOT NULL` (profil actif) **seulement** quand le diagnostic ne signale plus `DATE_NAISSANCE_MANQUANTE` — non posée à ce jour.
5. Vérification : relancer le diagnostic.
