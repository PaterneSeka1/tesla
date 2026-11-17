# 08 — Retour arrière

Aucun retour arrière ne touche à la base : les données écrites depuis la bascule restent (même API, même base dans tous les cas).

## 1. Après la bascule Vercel : revenir au Next.js de Vercel (≈ 1 min)

1. Vercel → *Deployments* → déploiement de production noté avant la bascule (07 § 3.1) → **Instant Rollback** (ou *Promote to Production*).
2. Contrôler : `curl -sI https://nikola-tesla-academie.vercel.app/connexion | grep -i x-vercel-cache` (réponse servie par Next.js sur Vercel) et `curl -s …/api/v1/health`.
3. Remettre le *Root Directory* à `apps/web` (et le framework Next.js) **avant** tout nouveau push sur `main`, sinon le déploiement suivant rebasculerait sur le proxy.

Pourquoi c'est sûr : l'ancien déploiement relaie `/api/v1` vers `api-tesla.veilleurdesmedias.org` (vhost API conservé, même secret, même `CORS_ORIGINS`) ; cookie, PWA et stockage local sont ceux du même domaine. Effet connu : l'anomalie de préparation hors ligne de Vercel réapparaît (01-audit § 6).

## 2. Défaut du web sur OVH (avant ou après la bascule)

```bash
sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/rollback.sh production   # dernière release saine
```

Rétablit le code précédent de l'API **et** du web (mode ovh), jamais une release `FAILED`, jamais une release sans build Next.js (celles construites en mode vercel, avant l'étape C) : juste après le premier déploiement en mode ovh, il n'existe donc aucune cible ; revenir alors au mode vercel (§ 3). Les migrations, additives, restent appliquées.

`deploy.sh` en échec de santé à l'étape C rétablit automatiquement la release de l'étape A : l'API repart, le web OVH reste en échec (cette release n'a pas de build Next.js ; systemd retente toutes les 5 s) — sans effet public tant que la bascule Vercel n'est pas faite. Corriger puis redéployer, ou arrêter `tesla-web@production` (`sudo systemctl stop`).

## 3. Revenir au mode vercel sur le VPS

Seulement après le § 1 et si l'on renonce à la migration :

```bash
sudo cp -p /etc/tesla/production.env.avant-ovh /etc/tesla/production.env
sudo systemctl disable --now tesla-web@production
sudo rm /etc/nginx/sites-enabled/tesla-production-origin && sudo nginx -t && sudo systemctl reload nginx
```

Le certificat et le fichier `sites-available/tesla-production-origin` peuvent rester (inactifs). Pas besoin de relancer `bootstrap.sh`.

## 4. Ce qu'il ne faut pas faire

Restaurer une sauvegarde pour « revenir en arrière » (perte des écritures) ; supprimer le projet Vercel ou ses anciens déploiements ; changer le secret du relais pendant l'incident ; rediriger le domaine Vercel vers le domaine OVH.
