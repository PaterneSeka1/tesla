# Audit de sécurité et protection des données

Audit du 2026-10-30 (branche `chore/preparation-production`). Chaque constat distingue ce qui est **vérifié** (test ou exécution constatée) de ce qui relève de la **revue de code**. Aucun test d'intrusion externe n'a été réalisé. Anomalies numérotées : [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md).

## 1. Synthèse

| Domaine | État | Vérification |
| --- | --- | --- |
| Authentification | Argon2id (m = 19 Mio, t = 2), comparaison factice pour un compte inconnu, message unique, sessions opaques (256 bits, hash SHA-256 en base), expiration absolue (12 h), révocation | Tests unitaires et d'intégration |
| Force brute | Limitation persistée en base par IP + e-mail (5), e-mail seul (10), IP (20), liens (20), mot de passe actuel (5) sur 15 min ; limitation Nginx d'appoint | Intégration (blocage, persistance, aucune adresse en clair) ; Nginx non testé |
| Cycle de vie des comptes | Création sans mot de passe, lien à usage unique (hash seul en base, 72 h, précédents révoqués), sessions fermées à l'activation, au changement de mot de passe (sauf la courante) et à la désactivation | Intégration (9 tests) et navigateur (9 contrôles) |
| Autorisation | Garde de session globale + `assertCan` dans chaque service ; permissions recalculées à chaque requête (mandat, délégation) ; comptes hors périmètre traités comme inexistants (404) | Intégration : refus 401/403/404 par rôle, périmètre, délégation échue |
| CSRF | En-tête `x-tesla-csrf` exigé sur toute écriture + contrôle de l'`Origin` ; cookie `SameSite=Lax`, `HttpOnly`, `Secure` en production | Unitaire et intégration (écriture sans en-tête → 403) |
| CORS | Liste blanche `CORS_ORIGINS`, `credentials` ; en production, origine unique derrière Nginx | Revue |
| En-têtes | API : `no-store`, `nosniff`, `DENY`, `no-referrer`, CORP, CSP `default-src 'none'` ; web : `frame-ancestors`, `base-uri`, `object-src`, `form-action`, `Permissions-Policy` ; HSTS par Nginx | Constatés par `curl` sur les serveurs de production locaux |
| Validation des entrées | Schémas Zod partagés pour chaque corps, requête et identifiant | Tests de contrats |
| Injection SQL | Prisma paramétré ; SQL brut uniquement en gabarits paramétrés (`$queryRaw`) ; `$executeRawUnsafe` limité au `TRUNCATE` des tests | Revue (`grep`) |
| XSS / contenu riche | Leçons en JSON par liste blanche (`lessonDocumentSchema`), jamais de HTML ; aucun `dangerouslySetInnerHTML` sur du contenu utilisateur | Revue et tests de contrat |
| Corrigés et barèmes | Jamais transmis au routier, jamais imprimés sur sa feuille, jamais conservés hors ligne | Intégration et recette |
| Énumération des comptes | Connexion : message et durée indistincts ; liens : réponse identique (invalide, expiré, utilisé) | Intégration |
| Journalisation | Ni corps ni chaîne de requête ; aucun mot de passe, jeton ni lien dans les journaux ; le lien d'installation n'est écrit que sur la sortie standard de la commande | Revue ; constaté sur les journaux de recette |
| Secrets | Aucun secret versionné ; `.env` ignoré ; modèle de production sans valeur ; comptes de démonstration impossibles en production | Revue |
| Dépendances | 532 paquets de production : aucune vulnérabilité connue (`npm run audit:prod`, 2026-10-30) | Exécuté |
| Données locales | Coffre IndexedDB AES-GCM 256, PBKDF2-SHA-256 600 000 itérations, clé non exportable, un coffre par compte ; aucune donnée API dans le cache du service worker | Recette (aucun texte en clair dans IndexedDB) |

## 2. Corrections apportées par cet audit

- Cycle de vie des comptes et installation sans mot de passe codé (AUD-001).
- Fuite entre comptes sur appareil partagé (AUD-002).
- Limitation persistante des tentatives (AUD-004).
- Délégation survivant à la fin du mandat du délégataire (AUD-005).
- En-têtes de sécurité, `no-store`, journaux sans chaîne de requête, écoute locale de l'API (AUD-016 à AUD-018).

## 3. Risques résiduels

| Risque | Mesure en place | Reste à faire |
| --- | --- | --- |
| Lien d'activation intercepté (transmis hors application) | Usage unique, 72 h, révocable par un nouveau lien, fragment d'URL non journalisé | Transmettre par canal personnel ; durée à valider (D118) |
| Compte d'administration compromis | Dernier administrateur protégé ; journal d'audit | Pas de double facteur ; nombre d'administrateurs à limiter |
| Appareil partagé, coffre déverrouillé | Verrouillage à la déconnexion et au changement de compte ; 12 h maximum | Sensibilisation ; durée D111 à valider |
| Compte désactivé encore utilisable hors connexion sur un appareil préparé | Données chiffrées ; borne de 14 jours ; toute écriture refusée au retour du réseau | Durée D112 à valider (AUD-031) |
| Fin anticipée de mandat effective le lendemain | — | AUD-013 |
| Absence de CSP de scripts côté web | `frame-ancestors`, `object-src`, `base-uri` | Nonces Next.js (AUD-038) |
| Accès physique au VPS | Base non exposée, sauvegardes chiffrées par clé publique | Chiffrement du disque selon l'hébergeur |

## 4. Données personnelles traitées

Routiers (18–21 ans) : nom, prénom, date de naissance, matricule, équipe, étape, résultats d'évaluations, observations d'accompagnement, présences, rattrapages. Encadrement : nom, adresse e-mail, mandats, délégations. Comptes : adresse e-mail, hash du mot de passe, sessions (navigateur, dates).

Principes appliqués : minimisation (pas de téléphone ni d'adresse postale), accès par permission et par périmètre, observations réservées, aucun accès des routiers aux fiches, journal d'audit en ajout seul, aucune suppression d'historique pédagogique, aucune donnée réelle dans le dépôt, les seeds ou les tests.

## 5. Mesures d'exploitation

PostgreSQL non exposé (écoute locale), API sur `127.0.0.1`, pare-feu limité à 22/80/443, TLS Let's Encrypt, sauvegardes chiffrées avec une clé publique (clé privée hors du VPS), copie hors site, journaux dans journald (90 jours), sudoers limité au redémarrage des services. Voir [DEPLOYMENT.md](DEPLOYMENT.md) et [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## 6. Conservation (à valider)

| Donnée | Durée proposée | Statut |
| --- | --- | --- |
| Historique pédagogique, audit | Conservation intégrale (règle existante : rien n'est supprimé) | Durée légale ou associative à confirmer |
| Sessions expirées | Conservées (traçabilité) | Purge à décider |
| Compteurs de connexion | Purgés après 1 jour d'inactivité | Appliqué |
| Opérations clientes (`client_operations`) | Aucune purge | À décider (AUD-030) |
| Journaux applicatifs (journald) | 90 jours | À valider |
| Journaux Nginx | 30 jours | À valider |
| Sauvegardes locales / hors site | 14 jours / selon la politique du stockage distant | À valider avec le RPO/RTO |
