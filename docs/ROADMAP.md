# Feuille de route

| Phase | Contenu | Statut |
| --- | --- | --- |
| **0 — Fondations** | Monorepo, Next.js, NestJS, Prisma, PWA de base, CI, documentation | ✅ en cours de validation |
| **1 — Authentification et comptes** | Connexion e-mail/mot de passe, sessions httpOnly, garde de rôle côté API et web, création des comptes par le responsable, comptes de développement synthétiques | ⏳ |
| **2 — Modules et publication** | Modules, leçons, versions ; workflow brouillon → soumis → publié / à revoir ; approbation par le responsable ; journal d'audit | ⏳ |
| **3 — Consultation et hors ligne** | Catalogue des modules publiés, lecteur, téléchargement IndexedDB, mise à jour des versions, progression de lecture | ⏳ |
| **1 bis — Routiers, équipes, évaluations papier (modèle)** | Profil routier sans compte, matricule, équipes et historique, tentatives multimodes, code `NT-AAAA-NNNNNN`, dérogations, contraintes SQL, services et tests d'intégration | ✅ modèle et services ; routes à brancher après la phase 1 |
| **4 — Évaluations et progression** | Moteur de quiz, accès selon l'étape, déblocages individuels, validation humaine des acquis, historique des étapes | ⏳ (règles à arbitrer) |
| **4 bis — Saisie papier et impression** | Routes et écrans : préparation, recherche par code, saisie et soumission des résultats, décision du responsable, téléversement des copies numérisées ; génération PDF serveur (support de cours, questionnaire nominatif, corrigé chef), sans IA | ⏳ (dépend des phases 1, 2 et 4) |
| **5 — Programme annuel** | Import et consultation du programme 2026–2027 (43 samedis), liens séances ↔ modules | ⏳ |
| **6 — Pilote et production** | Déploiement VPS (Nginx, PM2 ou systemd, TLS), sauvegardes PostgreSQL et restauration testée, supervision | ⏳ |

Les phases 2 à 4 dépendent des arbitrages listés dans [BUSINESS_RULES.md](BUSINESS_RULES.md).
