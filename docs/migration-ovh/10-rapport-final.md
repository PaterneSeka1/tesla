# 10 — Rapport avant bascule (2026-11-17)

**Statut : préparation terminée dans le dépôt ; migration NON réalisée.** Aucune action n'a été effectuée sur le VPS ni sur Vercel : le poste de développement n'a pas d'accès SSH autorisé au VPS ni d'accès au projet Vercel. La production est inchangée. Les critères d'acceptation de la mission ne sont donc pas atteints à ce stade.

## 1. État initial vérifié

Production publique fonctionnelle : web Next.js servi par Vercel, API sur OVH (`api-tesla.veilleurdesmedias.org`, base `up`), relais `/api/v1` par middleware Vercel avec secret (D167). Manifeste et `sw.js` en production identiques au dépôt. Détails et limites : [01-audit.md](01-audit.md).

## 2. Modifications effectuées (dépôt uniquement, non commitées)

| Fichier | Changement |
| --- | --- |
| `deploy/vercel-proxy/vercel.json`, `README.md` | Vercel en simple proxy : route unique vers l'origine, secret depuis `TESLA_PROXY_SECRET`, cache CDN désactivé |
| `deploy/nginx/tesla-origin.conf` | Vhost d'origine : 403 sans secret, adresse client fiable, hôte public imposé, API + web, pages d'indisponibilité, `Vercel-CDN-Cache-Control: no-store` |
| `deploy/scripts/common.sh` | Mode `WEB_HOSTING=ovh` |
| `deploy/scripts/deploy.sh` | Mode ovh : build complet, `NEXT_PUBLIC_API_URL=/api/v1`, `WEB_PORT`, `WEB_ORIGIN_DOMAIN` exigés |
| `deploy/scripts/healthcheck.sh` | Mode ovh : web contrôlé en local (`127.0.0.1:WEB_PORT`) |
| `deploy/scripts/rollback.sh` | Refuse une release sans build Next.js quand le web est sur le VPS |
| `deploy/scripts/bootstrap.sh` | Mode ovh : port du web vérifié libre, vhost d'origine + certificat, `tesla-web@` activé (non démarré), vhost API conservé |
| `deploy/env/production.env.example` | `WEB_HOSTING=ovh`, `WEB_ORIGIN_DOMAIN` |
| `deploy/scripts/tests/*` | Tests du mode ovh et de la configuration du proxy |
| `docs/migration-ovh/01…10` | Audit, PWA, architecture, déploiement, données, tests, bascule, retour arrière, exploitation |

Aucun code applicatif (web, API, shared) modifié ; `sw.js` et le manifeste intacts.

## 3. Architecture prévue

[03-architecture.md](03-architecture.md) : Vercel (`routes` + `transforms`) → vhost d'origine Nginx → `tesla-web@` (next start) et `tesla-api@` → PostgreSQL local. URL publique, cookie, service worker, stockage local et base inchangés.

## 4. Processus et services

systemd existant (`tesla-api@`, `tesla-web@`, timers de santé, sauvegarde, traitements quotidiens), Node.js 22 isolé (`/opt/node22/bin`). Ni PM2, ni Docker ajoutés.

## 5. Domaines et routage

Public : `nikola-tesla-academie.vercel.app` (inchangé). Origine : `tesla.veilleurdesmedias.org` (DNS déjà vers le VPS ; aujourd'hui servi par le site par défaut d'une autre application, jusqu'à l'étape B). API : `api-tesla.veilleurdesmedias.org` conservé pour le retour arrière.

## 6. Tests réellement exécutés

[06-tests.md](06-tests.md) § 1 : scripts (69/69), proxy (10/10 + refus `--ready`), `nginx -t` et 12 scénarios fonctionnels sur Nginx 1.24, vrai Next.js 16.4.3 derrière le vhost. Bloqués : tout ce qui exige le VPS, Vercel ou des appareils.

## 7. Résultats PWA

Vérifié : identité (manifeste) et service worker inchangés → pas de réinstallation ni de mise à jour forcée attendues ; origine inchangée → session, caches et IndexedDB conservés. Non vérifié : comportement réel sur Android et iPhone ([02](02-pwa-compatibilite.md) § 4). Anomalie préexistante trouvée sur Vercel (préparation hors ligne sans les scripts), corrigée de fait par l'hébergement OVH.

## 8. Résultats sur les données

Aucune migration de données nécessaire ni prévue. Sauvegardes de production **non vérifiées** (pas d'accès) : vérification et restauration d'essai obligatoires avant l'étape A ([05](05-sauvegardes-restauration.md)).

## 9. Résultats sécurité

Origine inaccessible sans secret (testé) ; secret jamais dans Git (testé) ; adresse client non usurpable (testé côté Nginx ; écrasement par Vercel documenté par Vercel, à confirmer) ; ports internes sur `127.0.0.1` ; cache CDN désactivé pour éviter toute réponse figée ; en-têtes de sécurité de Next.js conservés ; aucun contrôle désactivé.

## 10. Risques résiduels

1. Comportements Vercel non documentés : en-tête `Host` envoyé à l'origine, conservation de la chaîne de requête, effet de `x-vercel-enable-rewrite-caching` dans `routes` → essai en prévisualisation obligatoire ([07](07-bascule-vercel.md) § 2).
2. Mémoire du VPS pendant le build Next.js (non mesurée).
3. Pas d'instance de préproduction connue : sans elle, les écritures ne peuvent pas être testées via un proxy d'essai avant la bascule.
4. Après bascule, une panne du VPS rend le web indisponible (aujourd'hui seule l'API l'était) ; les PWA continuent hors ligne sur les pages préparées.
5. Le *Root Directory* du projet Vercel devra être remis à `apps/web` après un retour arrière, avant tout push.

## 11. Retour arrière

[08-rollback.md](08-rollback.md) : *Instant Rollback* Vercel vers le déploiement Next.js noté avant la bascule (≈ 1 min, sans effet sur les données) ; `rollback.sh` pour le code OVH ; retour au mode vercel par la copie `production.env.avant-ovh`.

## 12. À valider ou exécuter par un humain

1. Domaine d'origine : `tesla.veilleurdesmedias.org` (retenu le 2026-11-17, DNS en place).
2. Accès VPS : audit (04 § 1), sauvegarde et restauration d'essai (05 § 2).
3. Étapes A, B, C ([04](04-deploiement.md)).
4. Projet Vercel d'essai et contrôles ([07](07-bascule-vercel.md) § 2), idéalement avec une préproduction.
5. **Autorisation de bascule** par le responsable, puis 07 § 3.
6. Recette sur Android et iPhone ayant la PWA installée ([02](02-pwa-compatibilite.md) § 4) et recette fonctionnelle ([06](06-tests.md) § 3).
