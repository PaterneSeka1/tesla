# Liste de contrôle de livraison

À dérouler pour chaque version, d'abord en préproduction puis en production. Cocher, dater, signer.

## Avant la livraison

- [ ] CI verte sur la branche (jobs `quality`, `integration`, `browser`, `ops`).
- [ ] `CHANGELOG.md` et `docs/IMPLEMENTATION_STATUS.md` à jour ; décisions nouvelles dans `docs/DECISIONS.md`.
- [ ] Nouvelles migrations relues (SQL), additives ; sinon plan validé par écrit.
- [ ] Aucune règle pédagogique nouvelle sans décision du responsable.
- [ ] Nouvelle route API sensible (corrigés, barèmes, secrets, comptes) exclue du coffre hors ligne (`repository.ts`).
- [ ] Compatibilité avec les appareils non mis à jour : écritures rejouables de la version précédente toujours acceptées.
- [ ] Étiquette Git créée (`vAAAA.MM.JJ` ou SemVer).

## Préproduction

- [ ] `deploy.sh preproduction <étiquette>` réussi (sauvegarde, migrations, contrôle de santé), puis web Vercel de préproduction déployé sur la même étiquette.
- [ ] Recette manuelle des parcours touchés ([TEST_PLAN.md](TEST_PLAN.md) § 4), au moins Chrome Android et Safari iOS.
- [ ] Mise à jour testée avec des opérations hors ligne en attente sur un appareil.
- [ ] Retour arrière testé (`rollback.sh preproduction`) puis redéploiement.

## Production

- [ ] Fenêtre annoncée ; responsable plein informé.
- [ ] Dernière sauvegarde hors site présente et vérifiée (`verify-backup.sh`) depuis moins d'un mois.
- [ ] `deploy.sh production <étiquette>` réussi (API d'abord), puis déploiement Vercel de production de la même étiquette ; `curl https://<projet>.vercel.app/api/v1/health` OK.
- [ ] `healthcheck.sh` OK ; `systemctl --failed` vide ; en-têtes (`curl -I`) : HSTS, `no-store` sur l'API.
- [ ] Connexion, une fiche, un module publié, « Cet appareil » contrôlés.
- [ ] Journaux sans erreur 5xx inattendue pendant 30 minutes.

## Première mise en service uniquement

- [ ] Décisions bloquantes tranchées ou explicitement reportées ([PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) § 4).
- [ ] RPO/RTO validés ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)) ; exercice de restauration réalisé, durée mesurée.
- [ ] Clé privée de sauvegarde conservée hors ligne par deux personnes.
- [ ] Serveur installé par `deploy/scripts/bootstrap.sh` ([DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md) § 4) ; `MEDICAL_DATA_KEY` copiée hors VPS ; projet Vercel configuré (§ 8 : `NEXT_PUBLIC_API_URL=/api/v1`, `TESLA_API_ORIGIN`, `TESLA_PROXY_SECRET`, aucun secret de l'API).
- [ ] Autres applications du VPS vérifiées après installation (sites Nginx, ports, services).
- [ ] Premier administrateur créé par `create-admin.js` ; responsable plein désigné dans `/communaute`.
- [ ] Alerte d'essai reçue (`systemctl start tesla-alert@tesla-healthcheck-production`).
- [ ] Catalogue : points « à vérifier » relus avant `pedagogy:release -- --notes-verifiees` (D146).
- [ ] `nginx -t`, `certbot renew --dry-run`, pare-feu (`ufw status`), PostgreSQL non joignable depuis l'extérieur (`nmap` depuis un autre hôte).
- [ ] Sonde de disponibilité externe et destinataires d'alerte configurés.
