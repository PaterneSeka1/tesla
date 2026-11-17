# 07 — Bascule de Vercel en simple proxy

**Arrêt obligatoire : autorisation explicite du responsable avant le § 3.** Prérequis : [04](04-deploiement.md) terminé (étapes A, B, C et contrôles), sauvegarde du jour vérifiée ([05](05-sauvegardes-restauration.md)), recette de l'origine réussie ([06](06-tests.md) § 3), retour arrière relu ([08](08-rollback.md)).

## 1. Préparer le dépôt

1. Origine renseignée dans `deploy/vercel-proxy/vercel.json` : `https://tesla.veilleurdesmedias.org` (= `WEB_ORIGIN_DOMAIN`).
2. `bash deploy/scripts/tests/vercel-proxy.test.sh --ready` → « Configuration du proxy Vercel conforme ».
3. Ne pas encore changer le projet Vercel.

## 2. Essai en prévisualisation (projet Vercel séparé)

Le *Root Directory* est un réglage de projet : le changer sur le projet de production ferait basculer le prochain déploiement de `main`. L'essai se fait donc dans un **second projet Vercel**, jetable (`tesla-proxy-essai`), relié au même dépôt :

- *Root Directory* : `deploy/vercel-proxy` ; *Framework* : Other ; aucune commande de build.
- Variable `TESLA_PROXY_SECRET` (Sensitive) : **celle de la préproduction** si une instance de préproduction en mode ovh existe (recommandé ; son `CORS_ORIGINS` = l'adresse du projet d'essai). À défaut, celle de production : seules les lectures sont alors testables (les écritures sont refusées par `CORS_ORIGINS`, ce qui est attendu).

Contrôles (adresse `https://tesla-proxy-essai.vercel.app`, notée `$P`) :

```bash
curl -sI $P/connexion | grep -Ei '^HTTP|x-vercel-cache|cache-control|server'   # 200, pas de HIT au 2ᵉ appel
curl -sI $P/connexion | grep -i x-vercel-cache                                   # répéter : jamais HIT
curl -sI "$P/modules?x=1" | grep -i '^location'                                  # /connexion?suivant=%2Fmodules%3Fx%3D1 (chaîne conservée)
curl -s  $P/api/v1/health                                                        # "status":"ok"
curl -s  $P/manifest.webmanifest | head -c 80                                    # "id":"/"
curl -sI $P/sw.js | grep -i cache-control                                        # no-cache, no-store
```

Côté VPS : `tail -f /var/log/nginx/tesla-<instance>-origin.access.log` → requêtes 200 (aucune 403), adresse cliente réelle vue par l'API (journal des limitations), aucune entrée dans les journaux du site par défaut. Puis la recette de [06](06-tests.md) § 3 (préproduction : tous parcours ; production : lectures seulement), dont le plus gros ZIP de copies papier.

Tout écart (hôte, chaîne `_rsc`, cache, cookie) : arrêt, analyse, aucune bascule. Supprimer ensuite le projet d'essai.

## 3. Bascule (après autorisation)

Moment : heure creuse, pas de séance en cours, un opérateur VPS et un opérateur Vercel disponibles.

1. Vérifier que la production actuelle répond (`curl …/api/v1/health`) et noter l'**identifiant du déploiement de production Vercel en cours** (onglet *Deployments*) : c'est la cible du retour arrière.
2. Sauvegarde fraîche (05 § 2).
3. Projet Vercel `nikola-tesla-academie` → *Settings → Build and Deployment* : *Root Directory* `deploy/vercel-proxy`, *Framework Preset* Other (vercel.json le force aussi). Conserver toutes les variables existantes (`TESLA_PROXY_SECRET`, `TESLA_API_ORIGIN`, `NEXT_PUBLIC_API_URL`) : l'ancien déploiement en a besoin pour le retour arrière.
4. Déployer `main` en production (*Redeploy* du dernier commit de `main`, sans cache).
5. Contrôles immédiats (§ 2 avec `$P=https://nikola-tesla-academie.vercel.app`), connexion avec un compte de test, une lecture, une écriture sans conséquence, un PDF ; journaux : Vercel (*Logs*), `tesla-production-origin.*.log`, `journalctl -u tesla-web@production -u tesla-api@production`.
6. Appareils : protocole [02](02-pwa-compatibilite.md) § 4, étapes 7 à 11.
7. Surveillance renforcée 48 h ([09](09-exploitation.md)).

Critère d'échec → [08](08-rollback.md) sans attendre : connexion impossible, erreurs 5xx répétées, déconnexions en masse, réponse servie depuis le cache Vercel (`x-vercel-cache: HIT` sur une page), adresse cliente non distinguée.

## 4. Après une semaine stable

- Désactiver le relais de l'ancien web : rien à faire côté Vercel ; conserver le vhost API (retour arrière) jusqu'à décision.
- Mettre à jour [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) et le rapport final avec les résultats réels.
- Ensuite seulement, envisager la suppression de `TESLA_API_ORIGIN` du projet Vercel (ce qui rendrait l'ancien déploiement inutilisable).
