# Sauvegarde et restauration

Scripts : [`deploy/scripts/`](../deploy/scripts). Déploiement : [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Objectifs à valider

| Objectif | Proposition | Fondement |
| --- | --- | --- |
| Perte de données maximale (RPO) | 12 heures | Deux sauvegardes par jour (02:15 et 14:15 UTC). Les saisies hors ligne non synchronisées restent sur les appareils et ne sont pas concernées. |
| Délai de rétablissement (RTO) | 4 heures | Restauration de la dernière sauvegarde hors site sur un VPS réinstallé avec [DEPLOYMENT.md](DEPLOYMENT.md) |
| Rétention | 14 jours en local ; 90 jours hors site (proposition) | Politique du stockage distant |

**À valider** par le responsable et l'hébergeur ; à mesurer lors d'un exercice de restauration en préproduction.

## 2. Principe

1. `pg_dump` au format *custom* (compressé), sans propriétaires ni privilèges.
2. Contrôle : archive lisible contenant `_prisma_migrations` ; si `BACKUP_RESTORE_CHECK_URL` est défini, **restauration d'essai complète** dans une base jetable (`tesla_restore_check_*`, supprimée ensuite) avec comptage des tables principales.
3. Chiffrement GnuPG avec la **clé publique** de sauvegarde : le serveur peut chiffrer mais jamais déchiffrer. La clé privée est conservée hors ligne (deux exemplaires, deux personnes).
4. Empreinte SHA-256 (`.sha256`).
5. Copie hors VPS par `rclone copy --immutable`, puis `rclone check`.
6. Rétention locale (fichiers `tesla-*.dump.gpg` uniquement).

Exécution : `tesla-backup@<instance>.timer` ; avant chaque déploiement par `deploy.sh`. Échec → unité `failed`.

## 3. Sauvegarde manuelle

```bash
systemctl start tesla-backup@production && journalctl -u tesla-backup@production -n 30
```

## 4. Vérification d'intégrité (poste d'administration, clé privée disponible)

```bash
rclone copy offsite:tesla/production/tesla-<horodatage>.dump.gpg ./ && rclone copy offsite:tesla/production/tesla-<horodatage>.dump.gpg.sha256 ./
BACKUP_RESTORE_CHECK_URL=postgresql://<rôle_maintenance>@<serveur_de_test>/postgres \
  deploy/scripts/verify-backup.sh tesla-<horodatage>.dump.gpg
```

Contrôles : empreinte, déchiffrement, restauration complète (`--exit-on-error`), migrations présentes, comptage des tables principales ; la base jetable est supprimée. **À faire au moins une fois par mois et après chaque migration**, sur une machine distincte de la production.

## 5. Restauration en production

La restauration ne s'écrit **jamais** par-dessus une base existante : elle crée une nouvelle base, puis l'application y est basculée.

1. Annoncer l'interruption ; arrêter les écritures : `systemctl stop tesla-api@production tesla-web@production`.
2. Sauvegarder l'état courant, même dégradé : `deploy/scripts/backup.sh` (avec l'environnement de l'instance).
3. Restaurer (clé privée importée temporairement chez l'opérateur, jamais laissée sur le VPS) :
   ```bash
   BACKUP_RESTORE_CHECK_URL=postgresql://postgres@/postgres RESTORE_OWNER=tesla \
     deploy/scripts/restore.sh tesla-<horodatage>.dump.gpg tesla_restaure_<date>
   ```
4. **Bascule** : dans `/etc/tesla/production.env`, pointer `DATABASE_URL` vers `tesla_restaure_<date>` ; vérifier les migrations (`cd current/apps/api && npx prisma migrate status`) ; redémarrer les services ; `healthcheck.sh`.
5. Contrôles fonctionnels : connexion, une fiche, un module publié, le journal d'audit.
6. Conserver l'ancienne base jusqu'à la validation écrite du responsable ; sa suppression est une décision explicite, hors script.
7. Appareils : les opérations hors ligne postérieures à la sauvegarde sont renvoyées par les appareils ; celles qui portent sur des données absentes reviennent en conflit ou en rejet motivé, jamais appliquées en silence.

## 6. Tests exécutés (2026-10-30)

Sur `tesla_test` (outils PostgreSQL 18 du conteneur, clé GnuPG jetable) : sauvegarde avec restauration d'essai (13 migrations, tables comptées), chiffrement et empreinte ; vérification du fichier chiffré ; restauration dans une nouvelle base ; **refus** de restaurer sur une base existante ; **détection** d'un fichier altéré (empreinte). Base de démonstration supprimée après le test ; base de développement non touchée.

Non exécuté : copie rclone vers un distant réel, timers systemd, restauration sur VPS, mesure du RTO.
