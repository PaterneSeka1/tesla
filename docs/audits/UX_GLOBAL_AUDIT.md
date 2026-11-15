# Audit UX global — refonte 2026-11-15

Branche `feat/refonte-ux-editeur-hors-ligne` (depuis `main` 0084af3). Audit du code réel, pas seulement de la documentation. Les projets de référence VDM Live et INMI ont été lus sans aucune modification.

## 1. État initial de Tesla (constats vérifiés dans le code)

| Domaine | Constat | Gravité |
| --- | --- | --- |
| Hors connexion | Le coffre local exigeait une **phrase locale distincte du mot de passe** (≥ 12 caractères, `vault.ts`, D111) : deux secrets par compte. La clé AES était dérivée directement de la phrase : aucune clé de données encapsulée, donc **aucune rotation possible** (changement de phrase = perte des données locales). | Bloquant (exigence « un seul mot de passe ») |
| Hors connexion | Page de connexion hors ligne : deux champs « Mot de passe » (déverrouillage local et connexion en ligne impossible). | Majeur |
| Éditeur | Leçons en cartes repliables, une seule ouverte, **bouton « Enregistrer la leçon » manuel** ; changer de leçon était bloqué tant qu'une saisie n'était pas enregistrée ; aucune copie locale (fermeture = perte). | Majeur |
| Éditeur | Images uniquement par adresse https externe ; aucun envoi depuis l'appareil malgré le stockage R2 existant (D143). | Majeur |
| Éditeur | Encadrés pédagogiques rendus en lecture (titres reconnus, `lesson-structure.ts`) mais **non insérables** depuis l'éditeur. | Moyen |
| Éditeur | Une seule page longue : informations, leçons, ressources, textes, collaborateurs, historique ; 12 champs de métadonnées affichés d'emblée ; « Soumettre » sans vérification préalable. | Moyen |
| Publication | Motif de correction affiché seulement tant que la version est `A_CORRIGER` : disparaît dès la reprise de rédaction. Libellés « Soumettre », « Renvoyer ». | Moyen |
| Notifications | Deux variantes seulement (succès, erreur), même durée, répétitions possibles, animation non conditionnée à `prefers-reduced-motion`. | Faible |
| Lecture routier | Bonne : progression dans le module, précédente/suivante, reprise de lecture, images hors ligne. | — |
| Navigation, responsive | Bon socle (menu par permissions, D174) ; balayage 320–1440 px sans débordement. | — |

## 2. Comparaison avec VDM Live et INMI (lecture seule)

| Pratique | VDM Live | INMI | Tesla avant | Décision |
| --- | --- | --- | --- | --- |
| Schémas Zod partagés front/back | Non (types retapés à la main, class-validator) | Oui (`@inmi/shared`, `zodResolver`) | Oui (`@tesla/shared`) | Conserver (Tesla est déjà au niveau d'INMI) |
| Report des erreurs serveur sur les champs | — | `applyServerError` | Partiel | Recommandé (non réalisé) |
| Client API unique, `ApiError` typée, 401 | BFF + résultat discriminé | `ApiError` + `fields[]` | `apiFetch`/`apiSend`, `ApiError` | Conserver |
| Paquet UI séparé | `packages/ui` | `ui.tsx` monolithique (à éviter) | shadcn dans `components/ui` | Conserver shadcn ; pas de paquet séparé (une seule application) |
| Toasts typés, durée selon la gravité | 5 variantes, double `aria-live` | 4 variantes | 2 variantes | **Repris** : info/avertissement, durées, dédoublonnage, `motion-safe` |
| Brouillons locaux | — | `draft-storage.ts` (évaluations) | Aucun pour les leçons | **Repris** : brouillons locaux des leçons |
| `loading.tsx` / `error.tsx` par groupe de routes | Non | Oui | Squelettes par composant | Recommandé (non réalisé) |
| Sidebar repliable, état persistant | Oui | Non | Non | Non retenu (menu court, D174) |
| DataTable générique (`aria-sort`, `scope`) | Oui | Non | `ui/table` simple | Recommandé |
| KPI cliquables vers listes filtrées | — | Oui | Partiel (files d'attente cliquables) | Conserver |
| Playwright sur build de production, `fr-FR` | `e2e/` + tests visuels multi-tailles | config racine, traces | Recettes `*.browser.mjs` (Playwright hors dépendances) | Conserver ; recommandé : `@playwright/test` en dépendance de développement |
| Fichiers de 500–800 lignes | Oui (à éviter) | Oui (à éviter) | `correction-workspace.tsx` 649 | À surveiller |

## 3. Priorités retenues

1. **Mot de passe unique hors connexion** (exigence absolue) — lot 3, D180.
2. **Ne plus perdre de saisie** : enregistrement automatique, brouillon local, conflits explicites — lot 1, D179.
3. **Rédiger un cours simplement** : deux zones, blocs pédagogiques, images depuis l'appareil, vérification, aperçu mobile — lot 1, D178.
4. **Comprendre un retour de correction** — lot 2.
5. Notifications harmonisées — lot 3.

## 4. Décisions techniques

- D178 : blocs pédagogiques par titre de niveau 3 (aucun nouveau nœud, aucune migration) ; images de leçon stockées citées par chemin interne, contrôle d'appartenance au module à la création et à la modification, lecture après publication.
- D179 : enregistrement automatique (1,5 s, un envoi à la fois, révision optimiste, brouillon `localStorage`), sections libres de l'éditeur, vérification sans obligation nouvelle.
- D180 : coffre format 3 (DEK encapsulée par le mot de passe et par une clé d'appareil serveur), table `offline_devices` (migration additive), verrouillage après 2 h d'inactivité.

## 5. Non retenu ou reporté (avec motif)

- Refonte des tableaux de bord : ceux de D174 affichent déjà les éléments à traiter par rôle et les files de validation ; aucun défaut bloquant constaté au balayage. Reporté.
- Refonte de l'éditeur de questions d'évaluation (formulaire en ligne existant, correct) : seuls l'envoi et les retours ont été améliorés.
- Sidebar repliable, paquet UI séparé, DataTable générique : améliorations de confort sans défaut constaté ; reportées.
