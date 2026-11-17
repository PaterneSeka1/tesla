# 06 — Tests de la migration

Légende : **Réussi** (exécuté, résultat conforme) · **Échoué** · **Bloqué** (impossible sans accès) · **À faire** (manuel, non exécuté).

## 1. Tests exécutés localement (2026-11-17)

| # | Test | Méthode | Résultat |
| --- | --- | --- | --- |
| L1 | Scripts de déploiement, tous modes (69 contrôles, dont 11 pour le mode ovh : build complet, redémarrage API + web, refus d'une `NEXT_PUBLIC_API_URL` absolue, `WEB_PORT`/`WEB_ORIGIN_DOMAIN` exigés, aucune release créée par ces refus, `WEB_HOSTING` inconnu refusé, retour arrière refusé vers une release sans build Next.js — automatique ou explicite —, accepté sinon avec redémarrage API + web) | `bash deploy/scripts/tests/deploy-scripts.test.sh` | Réussi 69/69 |
| L2 | Configuration du proxy Vercel (route unique, secret depuis variable, aucun secret en clair, cache désactivé, aucun build) | `bash deploy/scripts/tests/vercel-proxy.test.sh` | Réussi 10/10 |
| L3 | `--ready` refuse l'origine non renseignée | même script `--ready` | Réussi (code 1 attendu) |
| L4 | Syntaxe `bootstrap.sh`, `healthcheck.sh` | `bash -n` | Réussi |
| L5 | `nginx -t` : vhost API + vhost d'origine + site étranger `default_server` | Docker `nginx:1.24` (version d'Ubuntu 24.04) | Réussi |
| L6 | Origine sans secret / mauvais secret | curl → Nginx 1.24 | Réussi : 403 / 403 |
| L7 | Avec secret : `Host` et `X-Forwarded-Host` = domaine public, `X-Forwarded-Proto: https`, adresse client = `X-Real-IP`, `X-Tesla-Client-Ip` falsifié et secret **retirés** avant l'application | upstreams d'écho | Réussi |
| L8 | `/api/…` vers l'API avec `Origin`, cookie et `x-tesla-csrf` transmis | upstream d'écho | Réussi |
| L9 | Requête arrivant avec l'hôte public → vhost Tesla (filet de sécurité) | curl `--resolve` | Réussi |
| L10 | `/api/docs` 404, fichiers cachés 403, HTTP 80 → 301 HTTPS | curl | Réussi |
| L11 | Vhost API inchangé : adresse usurpée ignorée sans secret, pas de page web (404) | curl | Réussi |
| L12 | API arrêtée → 503 JSON `no-store` ; web arrêté → page de maintenance `no-store` | upstreams arrêtés | Réussi |
| L13 | Vrai Next.js (`next start`, build `NEXT_PUBLIC_API_URL=/api/v1`) derrière le vhost : `/`, `/connexion`, `/hors-ligne` 200 ; `/accueil` et `/modules?x=1` sans cookie → 307 **relatif** vers `/connexion?suivant=…` ; `/routier` → `/accueil` ; `sw.js` `no-store` ; chunk `immutable` ; en-têtes de sécurité présents ; `Vercel-CDN-Cache-Control: no-store` partout | Next 16.4.3 + Nginx 1.24 | Réussi |
| L14 | Pages pré-rendues servies avec `Cache-Control: s-maxage=31536000` par Next auto-hébergé | même essai | Constaté : justifie la désactivation du cache Vercel |
| L15 | Manifeste et `sw.js` de production identiques au dépôt | curl + SHA-256 | Réussi |
| L16 | Ressources reconnues par `sw.js` : Vercel 0/49, OVH 53 | analyse des pages | Constaté (anomalie préexistante, voir 01-audit § 6) |

Non exécutés localement : `npm run lint`, `typecheck`, `test` (aucun code TypeScript modifié) ; ShellCheck (absent du poste) ; `systemd-analyze verify` (aucune unité modifiée).

## 2. Bloqués faute d'accès (VPS, Vercel, appareils)

| # | Test | Statut |
| --- | --- | --- |
| B1 | Audit du VPS (04 § 1) | Bloqué |
| B2 | Sauvegarde fraîche et restauration d'essai (05 § 2) | Bloqué |
| B3 | Étapes A, B, C sur le VPS et contrôles 04 § 6 | Bloqué |
| B4 | Prévisualisation Vercel du proxy (07 § 2) | Bloqué |
| B5 | Bascule et contrôles (07 § 3) | Bloqué (autorisation humaine requise) |

## 3. Recette fonctionnelle (à faire, après l'étape C puis après la bascule)

Comptes de test uniquement. Cocher deux colonnes : « origine (prévisualisation) » et « production après bascule ».

| Parcours | Contrôle |
| --- | --- |
| Routier | inscription depuis une fiche (lien d'activation), connexion, mot de passe oublié, accueil, modules, leçons, téléchargement d'un cours (PDF), quiz, progression, préparation hors ligne, consultation hors ligne, synchronisation |
| Encadrement | connexion, liste et fiche d'un routier, création de module, ajout de leçon, édition, évaluations, impression d'un cours, génération d'évaluations papier (plus gros lot réel : délai < 120 s), saisie de copies, contrôle des refus de permission |
| Plein / administration | approbation et publication, correction et validation des évaluations, comptes, référentiel d'âge ; fiche médicale de son propre compte |
| Sécurité | 4 demandes « mot de passe oublié » depuis un même poste → 429 à la 4ᵉ, et un autre poste non bloqué (adresse client distinguée) ; `POST /api/v1/auth/logout` avec `Origin: https://evil.example` → 403 ; aucune page privée avec `x-vercel-cache: HIT` |
| Compatibilité | ordinateur, navigateur mobile, Android Chrome, iPhone Safari, PWA installée (02 § 4), connexion lente (limitation réseau), coupure pendant une saisie, rechargement d'une page profonde |
| Reprise | `systemctl restart tesla-web@production` pendant une navigation ; arrêt bref de l'API puis reprise de la file hors ligne |
| Autres applications | sites des autres applications du VPS joignables avant et après (codes HTTP consignés) |

## 4. Journal d'exécution

| Date | Opérateur | Test | Résultat | Preuve |
| --- | --- | --- | --- | --- |
| 2026-11-17 | Claude Code (poste de développement) | L1–L16 | voir § 1 | sorties de commande de la session |
