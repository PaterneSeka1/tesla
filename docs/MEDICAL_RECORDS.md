# Fiches médicales personnelles

Décisions D135–D137 (2026-10-30). Code : `apps/api/src/modules/medical/`, `packages/shared/src/medical.ts`, `apps/web/src/components/accounts/medical-record-card.tsx`.

## Principe
- Une fiche **par compte** de routier ou de membre de l'encadrement (permission `medicalRecord.own`) : même modèle pour tous. Le compte administrateur, purement technique, n'en a pas (403, D142).
- Seul le titulaire la consulte, la crée, la modifie (sans limite), l'imprime, la télécharge et la supprime, depuis **Mon profil**. Aucune validation administrative.
- Aucune autre personne n'y accède : ni l'encadrement, ni le responsable plein, ni l'administrateur.

## Données
| Catégorie | Champs | Obligatoire |
| --- | --- | --- |
| Identification | nom, prénoms, date de naissance, matricule, équipe | lus depuis le compte et la fiche routier (non stockés) |
| Coordonnées | téléphone personnel | non |
| Contacts d'urgence | nom, lien, téléphone (2 au plus) | non (nom, lien et téléphone requis pour un contact ajouté) |
| Santé | allergies, traitements signalés, informations en cas d'urgence, précautions pour les activités, personne ou professionnel de santé à contacter | non |

Schéma strict (`medicalRecordDataSchema`) : un champ inconnu est refusé. Finalité affichée avant la saisie (`MEDICAL_RECORD_PURPOSE`).

### Quatre sections (D170)
Ordre commun au formulaire et au PDF (`MEDICAL_RECORD_SECTIONS`, `@tesla/shared`), aides à la saisie dans `MEDICAL_FIELD_HINTS` :

| Section | Champs |
| --- | --- |
| 1. Informations personnelles | identité lue depuis le compte ; téléphone personnel |
| 2. Contacts d'urgence | 2 contacts au plus ; personne ou professionnel de santé |
| 3. Informations de santé | allergies (médicaments, aliments, matières…, réaction) ; traitements (nom, raison, posologie) |
| 4. Consignes complémentaires | informations utiles en cas d'urgence (maladie à connaître des secours, conduite à tenir) ; précautions pour les activités (natation, effort, régime…) |

Les champs des sections 3 et 4 restent repliés derrière « Ajouter » tant qu'ils sont vides (affichage seul : aucune réponse « oui / non » n'est enregistrée ; « Retirer » vide le champ).

Rubriques de la fiche de liaison médicale de la région (« FICHE DE SANTÉ », mars 2024) **non reprises** : adresses (inutiles pour joindre en urgence), liste de maladies à cocher (couverte en texte libre par la section 4), questionnaire oui/non, vaccin antitétanique, sérum, paludisme, hospitalisations, signature du parent (exclue). Ajouter l'une d'elles est une décision du responsable (D137 : aucun champ nouveau sans validation) ; le contenu étant un JSON chiffré, un champ facultatif s'ajouterait sans migration.

## API
| Méthode | Route | Effet |
| --- | --- | --- |
| GET | `/me/medical-record` | `{ holder, record \| null }`, `Cache-Control: no-store` |
| PUT | `/me/medical-record` | création (`expectedRevision: null`) ou modification (révision lue) ; 409 `MEDICAL_RECORD_CHANGED` si la fiche a changé |
| DELETE | `/me/medical-record` | suppression définitive (`expectedRevision`) |
| GET | `/me/medical-record/pdf` | PDF A4 généré à la demande, `no-store`, jamais stocké ; 404 sans fiche |

Aucune route ne prend d'identifiant : pas d'URL prévisible vers la fiche d'autrui. Sans `MEDICAL_DATA_KEY` : 503 `MEDICAL_RECORDS_UNAVAILABLE`.

## Sécurité
- **Chiffrement** AES-256-GCM par l'API (IV aléatoire de 12 octets, étiquette de 16 octets, identifiant du titulaire en données associées) ; contraintes SQL sur la forme. Clé `MEDICAL_DATA_KEY` (32 octets base64) : obligatoire en production, à sauvegarder **séparément** des sauvegardes de base (sans elle, les fiches sont illisibles).
- **Concurrence** : mise à jour conditionnelle sur la révision ; deux créations simultanées → une seule fiche.
- **Journal d'audit** : `medical.created`, `medical.updated`, `medical.exported`, `medical.deleted` avec la seule révision ; aucun contenu médical. Une fiche illisible est journalisée par son identifiant seulement.
- **Hors ligne** : `/me/medical-record` exclu du dépôt local (`offline/repository.ts`) ; le service worker ne touche pas à l'API ; requête TanStack sans conservation après l'écran (`gcTime: 0`). Aucune préparation automatique.
- **Statistiques** : aucune agrégation des fiches.

## PDF
A4, logo et nom de la communauté, branche Route, date de dernière mise à jour en tête et en pied, titre « Fiche médicale », mention de confidentialité, puis les quatre sections : identité sur deux colonnes, **encadré des contacts d'urgence** (numéros en gras), informations de santé et consignes (« Non renseigné » en gris sinon), pagination. Pas de zone de signature (non prévue par le formulaire). Ouverture dans un nouvel onglet pour l'aperçu et l'impression, ou téléchargement.

## Conservation, rectification, suppression
- Rectification : à tout moment par le titulaire.
- Suppression : par le titulaire, définitive, sans historique.
- **À valider** : durée de conservation après la sortie de la branche ou la désactivation du compte (aucune purge automatique développée), information des titulaires mineurs et de leurs parents, base légale applicable.

## Non développé
- Habilitation d'accès d'urgence (personne chargée des secours) : à concevoir quand la communauté aura défini l'organisation (habilitation nominative, limitée, journalisée, distincte des permissions pédagogiques).
- Accès hors ligne aux fiches (conception de sécurité distincte requise).
- Rotation de la clé de chiffrement (colonne `key_version` prévue).
- Pièces jointes (aucun stockage de fichiers, D51).

## Tests
`apps/api/src/modules/medical/medical.spec.ts` (chiffrement, schéma, sections, configuration, PDF) ; `apps/api/test/medical-records.int-spec.ts` (création et modifications illimitées pour routier, chef et plein ; administrateur refusé (403) ; identité ; isolement et routes par identifiant en 404 ; 401/403 ; conflits et concurrence ; chiffré en base et audit sans contenu ; PDF A4 `no-store` ; suppression ; 503 sans clé) ; `apps/web/src/lib/offline/offline-first.test.ts` (exclusion du cache).
