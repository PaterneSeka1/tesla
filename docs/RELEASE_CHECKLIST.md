# Liste de contrôle de livraison

À dérouler pour chaque version, d'abord en préproduction puis en production. Cocher, dater, signer.

## Avant la livraison

- [ ] CI verte sur la branche (jobs `quality`, `integration`, `browser`).
- [ ] `CHANGELOG.md` et `docs/IMPLEMENTATION_STATUS.md` à jour ; décisions nouvelles dans `docs/DECISIONS.md`.
- [ ] Nouvelles migrations relues (SQL), additives ; sinon plan validé par écrit.
- [ ] Aucune règle pédagogique nouvelle sans décision du responsable.
- [ ] Nouvelle route API sensible (corrigés, barèmes, secrets, comptes) exclue du coffre hors ligne (`repository.ts`).
- [ ] Compatibilité avec les appareils non mis à jour : écritures rejouables de la version précédente toujours acceptées.
- [ ] Étiquette Git créée (`vAAAA.MM.JJ` ou SemVer).

## Préproduction

- [ ] `deploy.sh preproduction <étiquette>` réussi (sauvegarde, migrations, contrôle de santé).
- [ ] Recette manuelle des parcours touchés ([TEST_PLAN.md](TEST_PLAN.md) § 4), au moins Chrome Android et Safari iOS.
- [ ] Mise à jour testée avec des opérations hors ligne en attente sur un appareil.
- [ ] Retour arrière testé (`rollback.sh preproduction`) puis redéploiement.

## Production

- [ ] Fenêtre annoncée ; responsable plein informé.
- [ ] Dernière sauvegarde hors site présente et vérifiée (`verify-backup.sh`) depuis moins d'un mois.
- [ ] `deploy.sh production <étiquette>` réussi.
- [ ] `healthcheck.sh` OK ; `systemctl --failed` vide ; en-têtes (`curl -I`) : HSTS, `no-store` sur l'API.
- [ ] Connexion, une fiche, un module publié, « Cet appareil » contrôlés.
- [ ] Journaux sans erreur 5xx inattendue pendant 30 minutes.

## Première mise en service uniquement

- [ ] Décisions bloquantes tranchées ou explicitement reportées ([PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) § 4).
- [ ] RPO/RTO validés ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)) ; exercice de restauration réalisé, durée mesurée.
- [ ] Clé privée de sauvegarde conservée hors ligne par deux personnes.
- [ ] Premier administrateur créé par `create-admin.js` ; année scoute et responsable plein consignés.
- [ ] `nginx -t`, `certbot renew --dry-run`, pare-feu (`ufw status`), PostgreSQL non joignable depuis l'extérieur (`nmap` depuis un autre hôte).
- [ ] Sonde de disponibilité externe et destinataires d'alerte configurés.
