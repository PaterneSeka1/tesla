# Vercel, simple proxy de Tesla (WEB_HOSTING=ovh)

Dossier racine (*Root Directory*) du projet Vercel **après la bascule** : aucun build, aucune
fonction, aucune donnée. Toutes les requêtes de `https://nikola-tesla-academie.vercel.app` sont
relayées (réécriture externe, l'adresse affichée ne change pas) vers l'origine OVH, avec le secret
partagé `x-tesla-proxy-secret` lu dans la variable Vercel **sensible** `TESLA_PROXY_SECRET`
(jamais dans ce fichier).

- Origine : `tesla.veilleurdesmedias.org` (= `WEB_ORIGIN_DOMAIN` de l'instance de production) ;
  `bash deploy/scripts/tests/vercel-proxy.test.sh --ready` vérifie qu'une origine réelle est renseignée.
- Cache CDN de Vercel désactivé (`x-vercel-enable-rewrite-caching: 0`, doublé par
  `Vercel-CDN-Cache-Control: no-store` côté Nginx).

Procédure, essais en prévisualisation et retour arrière : [docs/migration-ovh/07-bascule-vercel.md](../../docs/migration-ovh/07-bascule-vercel.md).
