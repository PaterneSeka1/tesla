# AGENTS.md — règles communes aux agents (Codex, Claude Code, autres)

Ce dépôt est **Nikola Tesla Académie** : monorepo npm workspaces (Next.js + NestJS + Prisma/PostgreSQL). La référence complète est [CLAUDE.md](CLAUDE.md) ; ce fichier n'en reprend que l'essentiel.

## Règles impératives
- Lire [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) avant de travailler, puis uniquement les fichiers du module concerné.
- Ne pas committer, pousser, déployer ni modifier SCOUT-NDPST sans demande explicite.
- Aucune API d'intelligence artificielle dans l'application.
- Aucune règle pédagogique inventée : publication après approbation du responsable, validation des acquis exclusivement humaine (voir [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md)).
- Le profil routier (`ScoutProfile`) existe sans compte ; toute donnée pédagogique le référence. Ne jamais créer de second profil lors du rattachement d'un compte.
- Matricule : chaîne facultative, unique, normalisée, jamais générée. Code de tentative `NT-AAAA-NNNNNN` : émis côté serveur uniquement, immuable, jamais réutilisé, jamais traité comme un secret.
- Une tentative (papier ou numérique) ne modifie jamais automatiquement l'étape d'un routier ; seul le responsable décide et valide.
- Tests d'intégration sur base dédiée `*_test` uniquement (`npm run test:int -w @tesla/api`) ; jamais `migrate reset` ni `db push` sur une base contenant des données.
- Aucun secret, mot de passe ou donnée réelle dans le dépôt.
- Ne jamais présenter une simulation comme une fonctionnalité réelle ni un test non exécuté comme réussi.

## Vérifications avant livraison
```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## Règles détaillées
| Domaine | Fichier |
| --- | --- |
| Frontend | [.claude/rules/frontend.md](.claude/rules/frontend.md) |
| Backend | [.claude/rules/backend.md](.claude/rules/backend.md) |
| Base de données | [.claude/rules/database.md](.claude/rules/database.md) |
| Pédagogie | [.claude/rules/pedagogy.md](.claude/rules/pedagogy.md) |
| Usage de l'IA | [.claude/rules/ai-usage.md](.claude/rules/ai-usage.md) |
