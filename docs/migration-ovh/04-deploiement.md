# 04 — Déploiement du web sur OVH (sans toucher au trafic public)

À exécuter par un opérateur disposant de l'accès `ubuntu` (sudo) au VPS. Jusqu'à la bascule Vercel ([07](07-bascule-vercel.md)), le public continue d'utiliser le Next.js de Vercel : le nouveau vhost refuse toute requête sans secret, il n'est donc joignable par personne.

Commandes de référence : `deploy/scripts/` (scripts testés localement, voir [06-tests.md](06-tests.md)).

## 1. Audit du VPS (lecture seule, à consigner dans 06-tests.md)

```bash
nproc; free -h; df -h / /var /var/www; uptime
ss -ltnp                                   # ports pris : choisir un WEB_PORT libre (3000 par défaut)
ls -l /etc/nginx/sites-enabled/; sudo nginx -t
systemctl list-units 'tesla-*' --all; systemctl list-timers 'tesla-*'
sudo cat /var/www/tesla/production/current/REVISION      # version en service
sudo grep -E '^(WEB_HOSTING|API_PORT|WEB_PORT|PUBLIC_URL|CORS_ORIGINS|TESLA_NODE_DIR)=' /etc/tesla/production.env
/opt/node22/bin/node -v; /usr/bin/node -v
pg_lsclusters; sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/exec.sh production npx prisma migrate status
ls -lt /var/backups/tesla/production | head; sudo certbot certificates
pm2 ls 2>/dev/null; docker ps 2>/dev/null   # autres applications (ne rien modifier)
```

Conditions pour continuer : `nginx -t` réussi avant toute action ; au moins **2 Gio de mémoire disponible** pendant le build (`free -h`, sinon planifier le déploiement en heure creuse) ; `WEB_PORT` libre ; dernière sauvegarde de moins de 24 h et restauration d'essai réussie ([05](05-sauvegardes-restauration.md)).

## 2. DNS

Domaine d'origine retenu : **`tesla.veilleurdesmedias.org`**. Constaté le 2026-11-17 : l'enregistrement `A` pointe déjà vers le VPS (51.210.43.87), mais aucun vhost Tesla ne le sert : il tombe sur le site par défaut d'une autre application (certificat `api-ticketgala.veilleurdesmedias.org`). C'est attendu avant l'étape B, qui installe le vhost provisoire, obtient le certificat puis installe `tesla-production-origin`. Ne pas modifier le site par défaut de l'autre application. Si le VPS sert de l'IPv6, ajouter aussi `AAAA`. Ce nom n'est jamais communiqué aux utilisateurs.

## 3. Étape A — mettre l'API à la version cible, **en mode vercel** (procédure habituelle)

Les scripts du mode `ovh` doivent être présents dans la release en service (le contrôle de santé périodique utilise `current/deploy/scripts/healthcheck.sh`). On déploie donc d'abord la version cible **sans changer de mode**, pour séparer les migrations de schéma éventuelles du changement d'hébergement :

```bash
sudo -iu tesla
git -C /var/www/tesla/production/repo fetch --tags
git -C /var/www/tesla/production/repo checkout --detach <étiquette>
/var/www/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette>   # sauvegarde + migrate deploy
exit
```

Relire avant : `prisma migrate status` (§ 1). Les migrations sont additives (`migrate deploy`, jamais `reset` ni `db push`). Puis déployer le web Vercel de la **même étiquette** (procédure D167). Vérifier : [06-tests.md](06-tests.md) § 3.

## 4. Étape B — passer l'instance en mode ovh

```bash
sudo cp -p /etc/tesla/production.env /etc/tesla/production.env.avant-ovh   # copie de retour arrière
sudoedit /etc/tesla/production.env
#   WEB_HOSTING=ovh
#   WEB_PORT=3000                       (port libre vérifié)
#   NEXT_PUBLIC_API_URL=/api/v1
#   WEB_ORIGIN_DOMAIN=tesla.veilleurdesmedias.org
#   CORS_ORIGINS=https://nikola-tesla-academie.vercel.app   (inchangé, une seule origine)
cd ~/tesla && git fetch --tags && git checkout <étiquette>
sudo deploy/scripts/bootstrap.sh production api-tesla.veilleurdesmedias.org <e-mail_letsencrypt> --no-firewall
```

`bootstrap.sh` (idempotent) : refuse un `WEB_PORT` occupé ; réécrit le vhost API à l'identique du modèle ; obtient le certificat du domaine d'origine (`certonly --webroot`) puis installe `tesla-production-origin` ; chaque étape passe par `nginx -t` avec rétablissement de la version précédente en cas d'échec ; **active** `tesla-web@production` sans le démarrer. Aucun autre site, ni pare-feu (`--no-firewall`), ni journald n'est touché.

À comparer avant de lancer `bootstrap.sh` : `diff <(sed … deploy/nginx/tesla-api.conf) /etc/nginx/sites-available/tesla-production` — si le vhost API en service a été modifié à la main, reporter ces modifications dans le dépôt d'abord.

## 5. Étape C — construire et démarrer le web sur OVH

```bash
sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette>
```

En mode ovh : `NEXT_PUBLIC_API_URL=/api/v1` imposé, `npm ci` + build complet (shared, API, web) avec Node.js 22 isolé, sauvegarde, `migrate deploy` (rien de nouveau après l'étape A), bascule `current`, redémarrage `tesla-api@production tesla-web@production`, santé : API sur `PUBLIC_URL` **et** web sur `127.0.0.1:WEB_PORT/connexion` ; échec → retour automatique.

Effet public : redémarrage de l'API de quelques secondes (comme tout déploiement) ; le web public reste sur Vercel.

## 6. Contrôles sur le VPS

```bash
SEC="$(sudo sed -n 's/^ *"\([0-9a-f]\{32\}\)" 1;/\1/p' /etc/nginx/tesla/production-proxy.conf)"
O=tesla.veilleurdesmedias.org
curl -s -o /dev/null -w '%{http_code}\n' https://$O/connexion                          # 403
curl -s -o /dev/null -w '%{http_code}\n' -H "x-tesla-proxy-secret: $SEC" https://$O/connexion   # 200
curl -sI -H "x-tesla-proxy-secret: $SEC" https://$O/sw.js | grep -i cache-control   # no-store
curl -s  -H "x-tesla-proxy-secret: $SEC" https://$O/api/v1/health                  # "status":"ok"
curl -sI -H "x-tesla-proxy-secret: $SEC" https://$O/accueil | grep -i location      # /connexion?suivant=… (relatif)
ss -ltnp | grep -E ':(3000|4000|5432)\b'                                            # 127.0.0.1 uniquement
systemctl --failed; journalctl -u tesla-web@production -n 50 --no-pager
unset SEC
```

Ne jamais coller la valeur du secret dans un ticket, un rapport ou un historique partagé.
