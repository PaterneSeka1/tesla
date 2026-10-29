# Feuille de route

| Phase | Contenu | Statut |
| --- | --- | --- |
| **0 — Fondations** | Monorepo, Next.js, NestJS, Prisma, PWA de base, CI, documentation | ✅ en cours de validation |
| **1 — Authentification, équipes, routiers** | Connexion, sessions httpOnly, garde de rôle API et web, comptes de démonstration ; équipes, fiches routiers sans compte, affectations, observations, tableaux de bord | ✅ implémenté et testé — reste : gestion des comptes (création, activation, mot de passe) |
| **2 — Modules et publication** | Modules, leçons, versions, ressources, collaborateurs ; éditeur structuré ; workflow brouillon → soumis → approuvé → publié (corrections, refus, archivage) ; publication atomique ; historique des décisions ; bibliothèque, lecteur, impression navigateur | ✅ implémenté et testé (2026-10-29) — voir [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md) |
| **3 — Évaluations, papier et résultats** | Questionnaires versionnés (5 types de questions, barèmes, crédit partiel), approbation et publication par le responsable, passation en ligne, éligibilité et déblocages, tentatives papier (code unique, PDF questionnaire/corrigé/grille), correction humaine, examen des résultats, historique du routier | ✅ implémenté et testé (2026-10-29) — voir [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md) |
| **3 bis — Consultation hors ligne** | Téléchargement IndexedDB des modules publiés, mise à jour des versions, progression de lecture | ⏳ |
| **1 bis — Routiers, équipes, évaluations papier (modèle)** | Profil routier sans compte, matricule, équipes et historique, tentatives multimodes, code `NT-AAAA-NNNNNN`, dérogations, contraintes SQL, services et tests d'intégration | ✅ ; routes et écrans livrés en phases 1 et 3 |
| **4 — Progression et validation des acquis** | Validation officielle des acquis (modèle distinct, acte du responsable), historique structuré des étapes, arbitrage des règles provisoires (éligibilité, crédit partiel, communication des résultats) — moteur de quiz et déblocages livrés en phase 3 | ✅ implémenté ; référentiel et règles pédagogiques à arbitrer (voir FEATURES/PROGRESSION.md) |
| **1 ter — Comptes** | Création et désactivation des comptes par le responsable, activation, réinitialisation du mot de passe, révocation des sessions | ⏳ |
| **4 bis — Compléments papier** | Téléversement des copies numérisées, support de cours en PDF serveur (préparation, saisie, examen et PDF questionnaire/corrigé/grille livrés en phase 3) | ⏳ |
| **5 — Programme annuel** | Import et consultation du programme 2026–2027 (43 samedis), liens séances ↔ modules | ✅ import et gestion implémentés ; source officielle des séances à fournir |
| **6 — Pilote et production** | Déploiement VPS (Nginx, PM2 ou systemd, TLS), sauvegardes PostgreSQL et restauration testée, supervision | ⏳ |

Les phases 2 à 4 dépendent des arbitrages listés dans [BUSINESS_RULES.md](BUSINESS_RULES.md).
