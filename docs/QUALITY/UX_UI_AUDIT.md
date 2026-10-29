# Audit UX/UI (phase 6, 2026-10-29)

Constats vérifiés dans le code et par une recette Chromium headless (pas d'appareil physique).

## Constats initiaux
| # | Constat | Gravité |
| --- | --- | --- |
| 1 | `/` présentait trois cartes « Espace routier / chef / responsable » : un choix d'espace manuel, y compris pour un utilisateur connecté | Élevée |
| 2 | Six configurations de menu (`routier`, `chef`, `responsable`, `administration`, `evaluations`, `bibliotheque`) choisies selon l'URL : le responsable changeait de menu en passant de `/responsable` à `/chef/modules`, puis à `/administration/routiers` | Élevée |
| 3 | `/connexion` affichait le formulaire à un utilisateur déjà connecté ; `?suivant=` était suivi même vers une page interdite au rôle (écran « Accès refusé » juste après connexion) | Moyenne |
| 4 | Doublons : « Téléchargements » et « Synchronisation » menaient à la même page ; « Accueil » renvoyait vers l'écran de choix ; deux entrées « Tableau de bord » filtrées par rôle | Moyenne |
| 5 | Mobile : navigation horizontale défilante portant jusqu'à 20 entrées pour le responsable | Moyenne |
| 6 | Un layout et donc un cadre (sidebar, vérification de session) remonté à chaque changement de section | Faible (fluidité) |
| 7 | Tableaux de bord en texte brut (`<p>`), chargement « Chargement… » textuel, erreurs sans le composant commun | Moyenne |
| 8 | Quatre composants inutilisés (`planned-features`, `follow-up-overview`, `modules/review-overview`, `modules/editorial-overview`) | Faible |
| 9 | Une session expirée en cours d'usage ne renvoyait à la connexion qu'au prochain rechargement | Moyenne |

## Corrections
- Navigation par rôle : voir [NAVIGATION_ET_PERMISSIONS.md](../FEATURES/NAVIGATION_ET_PERMISSIONS.md) (constats 1 à 4, 6 et 9).
- Cadre : sidebar groupée (logo, groupes, page active, état du serveur, profil, déconnexion) ; mobile et tablette : en-tête compact et menu latéral accessible (piégeage du focus, Échap, cibles de 44 px), barre inférieure de 4 accès réservée au routier (constat 5).
- Tableaux de bord : cartes KPI cliquables, files d'actions séparées (contenus / décisions sur les routiers), répartitions par équipe et par étape, chronologie des activités, états de chargement (squelettes), vide et erreur communs (constat 7). Toutes les valeurs proviennent de l'API ; aucun graphique décoratif.
- Hiérarchie : chaque page a un `h1` (titre de page), l'en-tête desktop redondant est supprimé.
- Thème : palette officielle, `prefers-reduced-motion` respecté, `scroll-padding` sous l'en-tête collant, badge d'état du serveur lisible sur fond bordeaux.
- Code mort supprimé (constat 8).

## Non traité
- Formulaires, tableaux et dialogues des écrans métier : primitives shadcn/ui déjà homogènes (tableau à défilement contenu, champs avec `aria-invalid`), non retouchées écran par écran.
- « Leçons téléchargées » sur le tableau de bord routier : affiché seulement si le coffre local est déverrouillé (aucune lecture sans la phrase locale).
- Contraste non mesuré avec un outil dédié ; lecteurs d'écran non testés ; Safari iOS et Chrome Android non testés.
