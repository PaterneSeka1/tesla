# 03 — Architecture cible (WEB_HOSTING=ovh)

Décision D187. Toute la logique applicative sur le VPS OVH ; Vercel ne fait que relayer, sans build ni fonction.

```
Navigateur / PWA ── https://nikola-tesla-academie.vercel.app        (URL, cookie, SW, stockage inchangés)
        │
        ▼  Vercel : deploy/vercel-proxy/vercel.json
        │  route /(.*) → https://<WEB_ORIGIN_DOMAIN>/$1 (réécriture externe, URL affichée inchangée)
        │  + x-tesla-proxy-secret = $TESLA_PROXY_SECRET (variable sensible, écrase toute valeur du client)
        │  + X-Forwarded-For / X-Real-IP écrasés par Vercel (adresse réelle du visiteur)
        │  cache CDN désactivé (x-vercel-enable-rewrite-caching: 0)
        ▼  HTTPS
Nginx, vhost tesla-production-origin (deploy/nginx/tesla-origin.conf)
        │  403 sans secret exact · adresse client = X-Real-IP si secret exact
        │  Host transmis = domaine public · Vercel-CDN-Cache-Control: no-store · limites par IP
        ├─ /api/…  → 127.0.0.1:API_PORT  tesla-api@production (NestJS)  → PostgreSQL 18 (local)
        └─ /…      → 127.0.0.1:WEB_PORT  tesla-web@production (next start)
                                                                     Fichiers : R2 (URL signées)

Conservé pour le retour arrière : vhost tesla-production (api-tesla.veilleurdesmedias.org, tesla-api.conf)
```

## Pourquoi ce choix

| Option | Verdict |
| --- | --- |
| `rewrites` simples de vercel.json | Écartée seule : aucun moyen d'ajouter le secret ; l'origine serait publique et l'adresse client invérifiable |
| `routes` + `transforms` (documenté par Vercel, « Restricting your origin to Vercel traffic ») | **Retenue** : secret lu dans une variable d'environnement, jamais dans Git ; aucune fonction exécutée |
| Middleware Vercel conservé (comme `proxy.ts` aujourd'hui) | Écartée : garde du code exécuté chez Vercel, contraire à l'objectif |
| Redirection HTTP vers le domaine OVH | Interdite : changerait l'origine, donc perte de session, de PWA et de données locales |
| Docker, PM2 | Inutiles : systemd est déjà l'outil en place (unités `tesla-*@`, durcissement, journald) |

## Choix détaillés

- **Une seule origine pour le web et l'API** : `NEXT_PUBLIC_API_URL=/api/v1`, comme aujourd'hui ; Nginx route `/api/` vers l'API avant Next.js. Cookie, CSRF (`x-tesla-csrf` + `Origin`) et CORS (`CORS_ORIGINS` = origine Vercel) inchangés.
- **Hôte public imposé** (`proxy_set_header Host <domaine public>`) : toute URL construite par Next.js ou l'API désigne le domaine Vercel. Vérifié : les redirections de Next.js sont relatives (`Location: /connexion?suivant=…`).
- **Filet de sécurité** : le domaine public figure aussi dans `server_name` du vhost d'origine. Si Vercel transmettait l'hôte public au lieu de celui de la destination, la requête arriverait chez Tesla et jamais sur le site par défaut d'une autre application.
- **Vhost API conservé** tel quel : il porte le `map` du secret, l'`upstream` de l'API et sert l'ancien web Vercel en cas de retour arrière. Le vhost d'origine en dépend (une double définition empêcherait Nginx de démarrer).
- **Secret** : le même que celui du relais actuel (`/etc/nginx/tesla/production-proxy.conf` ↔ `TESLA_PROXY_SECRET`), donc aucune coordination de rotation pendant la bascule.
- **Processus** : `tesla-web@production` existant (mode historique), `next start` sur `127.0.0.1:WEB_PORT`, Node.js de TESLA (`/opt/node22/bin`), `MemoryMax=768M`, `Restart=on-failure`, journald. Aucun port exposé : Nginx seul écoute sur 80/443.
- **Base de données** : aucune migration de données, aucun changement de schéma, aucune copie : la base reste où elle est.

## Ce qui reste à confirmer en prévisualisation

En-tête `Host` reçu par l'origine ; conservation de la chaîne de requête (`?_rsc=`) par `routes` ; effet réel de `x-vercel-enable-rewrite-caching: 0` dans une route ; transmission de `Set-Cookie` et des corps binaires (déjà vraie pour `/api/v1` aujourd'hui) ; délai maximal d'une réponse relayée. Procédure : [07-bascule-vercel.md](07-bascule-vercel.md) § 2.
