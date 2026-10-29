# Feuille de route

| Phase | Contenu | Statut |
| --- | --- | --- |
| **0 — Fondations** | Monorepo, Next.js, NestJS, Prisma, PWA de base, CI, documentation | ✅ en cours de validation |
| **1 — Authentification, équipes, routiers** | Connexion, sessions httpOnly, garde de rôle API et web, comptes de démonstration ; équipes, fiches routiers sans compte, affectations, observations, tableaux de bord | ✅ implémenté et testé — reste : gestion des comptes (création, activation, mot de passe) |
| **2 — Modules et publication** | Modules, leçons, versions ; workflow brouillon → soumis → publié / à revoir ; approbation par le responsable ; journal d'audit | ⏳ |
| **3 — Consultation et hors ligne** | Catalogue des modules publiés, lecteur, téléchargement IndexedDB, mise à jour des versions, progression de lecture | ⏳ |
| **1 bis — Routiers, équipes, évaluations papier (modèle)** | Profil routier sans compte, matricule, équipes et historique, tentatives multimodes, code `NT-AAAA-NNNNNN`, dérogations, contraintes SQL, services et tests d'intégration | ✅ ; routes et écrans des routiers/équipes livrés en phase 1, tentatives en phase 4 bis |
| **4 — Évaluations et progression** | Moteur de quiz, accès selon l'étape, déblocages individuels, validation humaine des acquis, historique des étapes | ⏳ (règles à arbitrer) |
| **1 ter — Comptes** | Création et désactivation des comptes par le responsable, activation, réinitialisation du mot de passe, révocation des sessions | ⏳ |
| **4 bis — Saisie papier et impression** | Routes et écrans : préparation, recherche par code, saisie et soumission des résultats, décision du responsable, téléversement des copies numérisées ; génération PDF serveur (support de cours, questionnaire nominatif, corrigé chef), sans IA | ⏳ (dépend des phases 1, 2 et 4) |
| **5 — Programme annuel** | Import et consultation du programme 2026–2027 (43 samedis), liens séances ↔ modules | ⏳ |
| **6 — Pilote et production** | Déploiement VPS (Nginx, PM2 ou systemd, TLS), sauvegardes PostgreSQL et restauration testée, supervision | ⏳ |

Les phases 2 à 4 dépendent des arbitrages listés dans [BUSINESS_RULES.md](BUSINESS_RULES.md).
