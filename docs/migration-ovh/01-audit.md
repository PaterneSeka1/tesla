# 01 — Audit avant migration du web vers OVH

Audit du 2026-11-17, dépôt `PaterneSeka1/tesla`, branche `main` (`d21cf51`, synchronisée avec `origin/main`). Décision associée : D187.

## 1. Ce qui a été vérifié, et comment

| Élément | Méthode | Résultat |
| --- | --- | --- |
| Dépôt, branches, structure | `git`, lecture ciblée | Monorepo npm : `apps/web` (Next.js 16.4.3), `apps/api` (NestJS), `packages/shared`, `deploy/` |
| Production publique (web) | `curl` en lecture seule | `https://nikola-tesla-academie.vercel.app` servi par Vercel (`server: Vercel`, région `lhr1`) |
| Production publique (API) | `curl /api/v1/health` | `https://api-tesla.veilleurdesmedias.org` : Nginx, `status: ok`, `database: up` ; même réponse via le relais Vercel |
| Manifeste et `sw.js` en production | comparaison avec le dépôt | **Identiques** (manifeste octet pour octet ; SHA-256 de `sw.js` identique) |
| Accès au VPS | `ssh` non interactif (`ubuntu`, `root`, IPv4) | **Refusé** (clé non autorisée) : **aucun audit serveur réalisé** |
| Projet Vercel | aucun accès (CLI absente, connecteur non autorisé) | Réglages réels du projet **non vérifiés** |

Non vérifié faute d'accès (à faire avant la bascule, liste dans [04-deploiement.md](04-deploiement.md) § 1) : processus, ports, utilisateurs, vhosts, certificats, PostgreSQL, sauvegardes, timers, ressources du VPS ; date de création et réglages du projet Vercel.

## 2. Architecture actuelle (D167, vérifiée côté public)

```
Navigateur / PWA ── nikola-tesla-academie.vercel.app ── Vercel : Next.js (pages, sw.js, manifeste)
                                    └─ /api/v1/* ── proxy.ts (middleware Vercel) + secret
                                                    └─ api-tesla.veilleurdesmedias.org (Nginx OVH)
                                                         └─ tesla-api@production → PostgreSQL 18
```

Le web Next.js ne fait **aucun** appel serveur à l'API, n'a ni Server Action, ni WebSocket, ni SSE : il rend des pages génériques ; toutes les données passent par `/api/v1` depuis le navigateur. Le cookie de session (`tesla_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, sans `Domain`) appartient au domaine Vercel.

## 3. Architecture cible

Voir [03-architecture.md](03-architecture.md). En bref : Vercel devient un proxy sans build ; Next.js et l'API tournent sur le VPS derrière un **nouveau vhost d'origine** ; l'URL publique, le cookie, le service worker, le stockage local et la base ne changent pas.

## 4. Dépendances

- Domaine public `*.vercel.app` : appartient au projet Vercel, ne peut pas être pointé ailleurs ; Vercel reste donc indispensable comme proxy.
- Secret partagé `TESLA_PROXY_SECRET` (Vercel) = `/etc/nginx/tesla/production-proxy.conf` (VPS) : réutilisé tel quel.
- R2 (fichiers et sauvegardes), SMTP facultatif : inchangés.
- DNS : un enregistrement à créer pour le domaine d'origine (`WEB_ORIGIN_DOMAIN`).

## 5. Risques identifiés

| Risque | Gravité | Traitement |
| --- | --- | --- |
| Cache CDN Vercel sur les réécritures externes (activé par défaut pour les projets créés depuis le 2026-04-06) alors que Next.js auto-hébergé envoie `Cache-Control: s-maxage=31536000` sur les pages pré-rendues (constaté) : pages figées un an, scripts supprimés après un déploiement | **Critique** | Cache désactivé deux fois : `x-vercel-enable-rewrite-caching: 0` (vercel.json) et `Vercel-CDN-Cache-Control: no-store` (Nginx). À contrôler en prévisualisation |
| Adresse IP client (limitations D165) : Nginx ne voit que Vercel | Élevée | Adresse reprise de `X-Real-IP` (écrasé par Vercel) **seulement** si le secret est exact |
| Accès direct à l'origine (contournement de Vercel, usurpation d'adresse, utilisateurs sur le mauvais domaine) | Élevée | Vhost d'origine : 403 sans secret exact |
| En-tête `Host` transmis par Vercel non documenté : une requête mal aiguillée tomberait sur le site par défaut d'une autre application | Élevée | Hôte public ajouté au `server_name` du vhost d'origine ; à contrôler en prévisualisation |
| Délai et taille des réponses relayées (ZIP de lots, PDF) | Moyenne | Déjà relayées par Vercel aujourd'hui (même mécanisme) ; à contrôler avec le plus gros lot réel |
| Build Next.js sur le VPS partagé (mémoire) | Moyenne | Mémoire libre à vérifier ; build hors service (`deploy.sh`), jamais pendant une forte charge |
| Interruption de quelques secondes au redémarrage de `tesla-web@` | Faible | Page de maintenance ; mêmes effets qu'un déploiement Vercel sans *skew protection* |

## 6. Anomalies constatées

1. **Préparation hors ligne incomplète sur Vercel (préexistante)** : Vercel sert les scripts sous `/_next/static/immutable/…` ; l'expression de `sw.js` (`static/(chunks|css|media)/`) n'en reconnaît **aucune** (0 sur 49 pour `/connexion`). « Préparer hors ligne » enregistre donc les pages mais pas leurs scripts : seuls ceux déjà chargés en ligne sont disponibles hors connexion. Servis par OVH (`/_next/static/chunks/…`), 53 références sont reconnues. La migration corrige ce défaut sans modifier `sw.js` ; en cas de retour sur Vercel, il réapparaît. Correction de `sw.js` possible séparément (elle déclencherait une mise à jour du service worker sur tous les appareils).
2. L'API renvoie `x-powered-by: Express` (information inutile exposée ; mineur, hors périmètre).
3. Projet Vercel et VPS non accessibles depuis le poste de développement : toute la suite d'exécution dépend d'un opérateur disposant des accès.

## 7. À conserver absolument

URL publique ; manifeste (`id: '/'`, `start_url`, `scope`) ; `sw.js` (contenu inchangé, donc aucune mise à jour forcée) ; nom et attributs du cookie ; `CORS_ORIGINS` (= origine Vercel) ; base `tesla_production` et ses migrations ; `MEDICAL_DATA_KEY` ; secret du relais ; vhost API `api-tesla.veilleurdesmedias.org` (il sert le retour arrière).

## 8. À modifier

`WEB_HOSTING=ovh`, `WEB_PORT`, `NEXT_PUBLIC_API_URL=/api/v1`, `WEB_ORIGIN_DOMAIN` dans `/etc/tesla/production.env` ; nouveau vhost `tesla-production-origin` ; activation de `tesla-web@production` ; *Root Directory* du projet Vercel (`deploy/vercel-proxy`).

## 9. À ne surtout pas toucher

Autres sites Nginx et site par défaut ; Node.js système (`/usr/bin/node`) ; autres clusters PostgreSQL ; UFW et journald ; données de la base (aucune migration n'est liée à ce changement) ; IndexedDB et caches des appareils.
