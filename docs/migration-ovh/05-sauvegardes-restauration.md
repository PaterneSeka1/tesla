# 05 — Données, sauvegardes et restauration

## 1. Constat : aucune migration de données

PostgreSQL est déjà sur le VPS (D167) et y reste. La migration ne déplace ni ne copie aucune donnée : même base (`tesla_production`), même rôle, mêmes fichiers R2, même clé `MEDICAL_DATA_KEY`. Aucune migration Prisma n'est liée au changement d'hébergement ; celles de la version cible sont appliquées à l'**étape A** ([04](04-deploiement.md) § 3), séparément, par la procédure habituelle.

Écritures possibles pendant la bascule : celles de l'API (connexions, saisies, synchronisations hors ligne). L'API reste la même instance avant, pendant et après la bascule Vercel : aucune fenêtre de maintenance n'est nécessaire pour la cohérence des données. Les seules interruptions sont les redémarrages de l'API par `deploy.sh` (quelques secondes ; les opérations hors ligne en échec sont réessayées par la file).

Fichiers (documents pédagogiques, PDF générés, fiches) : stockés sur R2 privé ou générés à la demande ; jamais sur le disque du web. Fiches médicales : chiffrées en base, lues par l'API seule ; aucun changement.

## 2. Avant toute intervention (obligatoire)

```bash
sudo systemctl start tesla-backup@production          # sauvegarde chiffrée + copie R2 vérifiée
systemctl status tesla-backup@production --no-pager   # « status=0/SUCCESS »
ls -lt /var/backups/tesla/production | head -3        # horodatage = point de restauration
```

Consigner dans [06-tests.md](06-tests.md) : nom du fichier `tesla-<horodatage>.dump.gpg`, empreinte `.sha256`, présence dans R2 (`rclone ls`).

**Restauration d'essai isolée** (jamais par-dessus la base en service) : procédure [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) § 4 ou `verify-backup.sh`, dans une base jetable `tesla_restore_check_*`, avec comptage des tables principales (utilisateurs, fiches, modules, tentatives). Sans restauration d'essai réussie, ne pas engager l'étape A.

`deploy.sh` refait une sauvegarde avant chaque `migrate deploy`.

## 3. Restauration en cas d'incident sur les données

Uniquement si des données ont été corrompues (aucun scénario de la migration ne le prévoit) : [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) § 5 — restauration dans une **nouvelle** base, puis `DATABASE_URL` modifié. Elle fait perdre les écritures postérieures à la sauvegarde : décision humaine du responsable, jamais automatique. Un retour arrière applicatif ([08](08-rollback.md)) ne touche jamais à la base.

## 4. Non vérifié à ce jour

Faute d'accès au VPS (2026-11-17) : existence, fraîcheur et restaurabilité des sauvegardes de production ; état des timers `tesla-backup@production` ; cycle de vie du compartiment `tesla-backups`. À vérifier au § 2 avant tout.
