# NIKOLA TESLA ACADÉMIE
## Chantier 3 — Perfectionnement global, immersion avancée, fiabilité et expérience communautaire

## 1. Rôle et mission

Tu interviens en tant qu'architecte logiciel senior, développeur full-stack senior, Product Designer, Game Designer, Motion Designer, expert UI/UX, spécialiste en pédagogie interactive, cybersécurité, accessibilité, performance et applications offline-first.

Dépôt : https://github.com/PaterneSeka1/tesla

Projet : Nikola Tesla Académie.

Tu dois poursuivre les travaux existants afin de faire de Tesla une application pédagogique scoute moderne, immersive, interactive, fiable et réellement agréable à utiliser.

Deux grands chantiers ont déjà été réalisés. Ils ont introduit un accueil simplifié, un lecteur immersif, une carte de progression, un moteur de jeux, des récompenses, des révisions espacées, une sauvegarde des parties et plusieurs améliorations techniques.

Cependant, certaines fonctionnalités restent incomplètes et l'expérience n'atteint pas encore pleinement la vision initiale.

Je veux que le routier puisse utiliser Tesla par plaisir, apprendre naturellement, découvrir des connaissances, jouer, relever des défis et vivre une véritable aventure pédagogique.

Il doit pouvoir y consacrer volontairement une ou deux heures sans avoir constamment l'impression d'étudier ou de passer des examens.

L'objectif n'est pas de créer une application addictive, mais de rendre l'apprentissage intrinsèquement intéressant.

Tu dois réaliser les améliorations, pas simplement produire un audit, un plan ou une maquette.

---

# PARTIE I — PRINCIPES NON NÉGOCIABLES

## 2. Préserver l'existant

Il ne s'agit pas d'une nouvelle refonte complète.

Conserver impérativement :

- Les fonctionnalités existantes.
- Les données.
- Les contenus pédagogiques.
- Les modules et leçons.
- Les questionnaires.
- Les versions publiées.
- Les workflows d'approbation.
- Les règles de progression par âge.
- Les rattrapages.
- Les validations officielles.
- Les permissions.
- Les apprenants adultes.
- Les routiers sans compte.
- Les évaluations papier.
- Les fiches médicales.
- La gestion des équipes.
- Le programme annuel.
- Les activités.
- Les notifications.
- Le fonctionnement hors ligne.
- Les protections de sécurité.
- Les composants et services de qualité.

Ne pas développer un nouveau moteur lorsqu'un moteur existant peut être enrichi.

Ne pas remplacer arbitrairement l'architecture actuelle.

Ne pas supprimer des données pour simplifier une interface.

## 3. Simplicité absolue

Cette règle est prioritaire pour toute l'application.

Je ne veux aucune information inutile qui surcharge les interfaces.

Chaque élément doit justifier sa présence par son utilité immédiate, sa valeur pédagogique ou sa contribution réelle à l'immersion.

Supprimer, déplacer, regrouper ou simplifier :

- Les titres répétés.
- Les descriptions évidentes.
- Les paragraphes introductifs inutiles.
- Les statistiques sans utilité.
- Les boutons redondants.
- Les badges décoratifs.
- Les cartes imbriquées.
- Les menus dupliqués.
- Les informations techniques.
- Les alertes répétitives.
- Les filtres rarement utilisés.
- Les textes qui expliquent ce que l'interface montre déjà.
- Les éléments affichés uniquement pour remplir l'espace.

Une seule action principale par écran.

Une seule recommandation principale à la fois.

Les actions secondaires doivent rester accessibles sans concurrencer l'action principale.

Appliquer la divulgation progressive : afficher les informations détaillées uniquement lorsqu'elles deviennent nécessaires.

Ne pas ajouter une nouvelle destination de navigation pour chaque fonctionnalité.

La complexité doit être prise en charge par le système, jamais transférée à l'utilisateur.

## 4. Philosophie produit

Tesla repose sur trois piliers :

- APPRENDRE : découvrir et comprendre.
- JOUER : pratiquer, mémoriser et expérimenter.
- VIVRE : appliquer les connaissances dans la vie scoute réelle.

Ces piliers ne doivent pas devenir trois applications indépendantes.

Conserver une application unique, une authentification unique et un design system commun.

L'expérience des routiers doit être immersive.

L'expérience des chefs doit être efficace, professionnelle et simple.

---

# PARTIE II — AUDIT ET CONSOLIDATION GIT

## 5. Analyse de toutes les branches

Avant toute modification, vérifier l'état local et distant du dépôt.

État constaté lors de l'audit du 25 novembre 2026 :

| Branche | Avance sur main | Retard |
|---|---:|---:|
| main | 0 | 0 |
| feat/sortie-adulte-fiche-medicale | 0 | 8 |
| fix/progression-audit | 7 | 1 |
| feat/tesla-immersive-learning | 20 | 0 |
| feat/tesla-immersive-audit | 28 | 0 |

Le commit de référence de main était `3a80bea`.

La branche `feat/tesla-immersive-audit` contenait intégralement `feat/tesla-immersive-learning` et possédait huit commits supplémentaires.

Ces informations doivent être revérifiées.

Exécuter notamment :

```bash
git status
git remote -v
git fetch --all
git branch -a
git branch -vv
git log --all --graph --decorate --oneline
```

Vérifier :

- Les commits non poussés.
- Les modifications locales.
- Les fichiers non suivis.
- Les divergences.
- Les migrations.
- Les conflits potentiels.
- Les fonctionnalités présentes uniquement dans certaines branches.

Prendre comme base la branche la plus complète après vérification.

Si une nouvelle branche est nécessaire, utiliser par exemple :

`feat/tesla-immersive-excellence`

Ne pas fusionner une deuxième fois des branches déjà intégrées.

Ne pas utiliser de reset destructif, de force push ou de suppression de branche.

Respecter les règles Git existantes dans le dépôt.

## 6. Documentation obligatoire

Lire les documents existants, notamment :

- `CLAUDE.md`
- `.claude/rules/`
- `README.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TESLA_IMMERSIVE_PROGRESS.md`
- `docs/prompts/TESLA_IMMERSIVE_LEARNING.md`
- `docs/FEATURES/EXPERIENCE_IMMERSIVE.md`
- `docs/FEATURES/PROGRESSION_PAR_AGE.md`
- `docs/FEATURES/RATTRAPAGE.md`
- `docs/QUIZ_ENGINE.md`
- `docs/OFFLINE_FIRST.md`
- `docs/USER_JOURNEYS.md`
- `docs/DATABASE.md`
- Les autres documents pertinents.

Adapter cette liste aux fichiers réellement disponibles.

Identifier les contradictions entre documentation et implémentation.

Ne pas considérer un lot terminé uniquement parce que la documentation l'indique.

## 7. Audit réel avant développement

Lancer l'application dans un environnement local sécurisé.

Utiliser les bases de test et les comptes de démonstration autorisés.

Inspecter les interfaces dans un navigateur.

Tester les parcours des routiers, adultes, chefs et administrateurs.

Établir un état initial :

- Fonctionnalités existantes.
- Fonctionnalités incomplètes.
- Anomalies.
- Tests.
- Performances.
- Captures d'écran.
- Surcharge visuelle.
- Fluidité.
- Accessibilité.
- Fonctionnement hors ligne.
- Risques de sécurité.

Reproduire les problèmes des audits précédents avant de les corriger.

Ne pas inventer des anomalies qui ne sont plus présentes.

Ne pas réimplémenter des correctifs déjà réalisés.

---

# PARTIE III — FIABILISATION TECHNIQUE PRIORITAIRE

## 8. Sauvegarde complète des expériences

Auditer notamment :

- `game-session.ts`
- `game-play.tsx`
- `practice-results.ts`
- `activity-runner.tsx`
- `sequence-game.tsx`
- `ascension-game.tsx`
- `memory-game.tsx`
- `reader-state.ts`
- Les composants de chaque type d'activité.

La sauvegarde actuelle a été améliorée, mais la persistance des réponses à l'intérieur des activités reste incomplète.

Créer un contrat commun de persistance permettant de reprendre exactement une expérience interrompue.

Conserver selon le type d'activité :

- L'identifiant de session.
- L'identifiant de tentative.
- Les exercices sélectionnés.
- Leur ordre.
- Les versions et empreintes des contenus.
- La question actuelle.
- Les réponses déjà données.
- Les réponses partiellement saisies.
- Les indices utilisés.
- Les jokers.
- Les cartes retournées.
- Les paires trouvées.
- L'ordre des éléments.
- Les états de réussite ou d'erreur.
- Les explications déjà affichées.
- Les récompenses en attente.
- Les résultats non synchronisés.

Appliquer cette persistance :

- Aux quiz.
- Aux vrais ou faux.
- Aux associations.
- Aux flashcards.
- Aux jeux de mémoire.
- Aux textes à compléter.
- Aux frises.
- Aux mises en situation.
- À L'Ascension.
- Aux nouvelles expéditions.
- Aux activités intégrées dans les leçons.

La reprise doit fonctionner après actualisation, changement de jour, interruption réseau et fermeture complète lorsque le stockage durable sécurisé est disponible.

Ne pas promettre une reprise durable lorsque seul sessionStorage est disponible.

## 9. Réconciliation des sauvegardes

Corriger le comportement de `game-session.ts` lorsque l'écriture dans le coffre échoue et qu'une sauvegarde de secours est enregistrée dans sessionStorage.

Le chargement doit rechercher les sauvegardes valides autorisées, déterminer laquelle est la plus récente et réconcilier les données sans écraser une progression plus récente.

Prévoir :

- Des révisions de sauvegarde.
- Une validation du schéma.
- Une identification du compte.
- Une gestion des écritures concurrentes.
- Une récupération après interruption.
- Une migration des formats.
- Une stratégie de nettoyage.

Éviter les courses entre plusieurs écritures.

Ne pas effectuer d'effets de bord non maîtrisés dans les fonctions de mise à jour d'état React.

Vérifier le comportement sous React Strict Mode.

## 10. Isolation des comptes

Toutes les données personnelles locales doivent être isolées par utilisateur.

Vérifier notamment :

- Les parties.
- Les résultats en attente.
- Les lectures.
- Les favoris.
- Les notes.
- Les expéditions.
- Les préférences personnelles.
- Les téléchargements.
- Les caches de requêtes.
- Les états React persistants.

Tester deux comptes sur un même appareil.

Tester plusieurs onglets.

Tester la déconnexion et la reconnexion pendant une synchronisation.

Une réponse réseau appartenant à un ancien compte ne doit jamais modifier l'interface du nouveau compte.

Ne pas exposer les données d'un compte à un autre.

## 11. Durée de conservation des sessions

Le mécanisme actuel prévoit notamment une durée de 14 jours.

Évaluer la pertinence de cette durée.

Distinguer :

- Une partie abandonnée.
- Une expédition réellement commencée.
- Une lecture interrompue.
- Un résultat en attente de synchronisation.
- Une préférence.
- Un cache temporaire.

Ne pas appliquer arbitrairement la même expiration à toutes les données.

Les résultats non synchronisés ne doivent pas être supprimés uniquement parce qu'ils sont anciens.

Prévoir une politique explicite et documentée.

Ne pas supprimer silencieusement les données d'apprentissage.

## 12. File de résultats persistante

Auditer `practice-results.ts`.

La liste actuelle des résultats en attente est limitée aux cinquante derniers éléments et repose sur des opérations de lecture-modification-écriture.

Cette architecture peut provoquer des pertes lorsque plusieurs écritures interviennent simultanément ou lorsque la limite est dépassée.

Réutiliser de préférence la file d'opérations hors ligne existante.

Chaque tentative doit être enregistrée indépendamment avec :

- Identifiant unique.
- Compte propriétaire.
- Contenu concerné.
- Version.
- Réponses.
- Date de création.
- État.
- Nombre de tentatives d'envoi.
- Dernière erreur.
- Stratégie de reprise.

Ne jamais supprimer silencieusement un résultat pour respecter une limite de stockage.

Prévoir un traitement explicite du stockage insuffisant.

Éviter les duplications entre la file existante et un nouveau système.

## 13. Synchronisation globale

Centraliser la synchronisation au niveau du cadre authentifié ou d'un service commun.

La synchronisation doit pouvoir se déclencher :

- Au retour du réseau.
- Après une authentification valide.
- Après le déverrouillage du coffre.
- Au retour dans l'application.
- Lorsqu'une opération est ajoutée.
- Lors d'une relance manuelle.

Ne pas dépendre uniquement de la présence d'ActivityRunner ou d'un jeu à l'écran.

Prévoir une gestion des erreurs temporaires, un backoff raisonnable et une protection contre les synchronisations simultanées.

Ne pas spammer l'API.

Les informations de synchronisation doivent rester discrètes.

## 14. Enregistrement avant envoi

Lorsque possible, enregistrer de manière fiable une tentative terminée avant son envoi réseau.

Un résultat ne doit pas être perdu si l'utilisateur ferme immédiatement l'application après avoir terminé une activité.

Les identifiants de tentative doivent être générés une seule fois et conservés pendant tous les rejeux.

Ne pas générer un nouvel identifiant à chaque nouvelle tentative d'envoi.

Prévoir une protection contre les doubles clics et les soumissions concurrentes.

## 15. Idempotence complète

Auditer `practice.service.ts`, `learning.ts`, les contrats partagés et les opérations hors ligne.

La nouvelle table `practice_attempts` constitue une bonne fondation.

Renforcer le contrôle d'une tentative rejouée.

Comparer l'identité sémantique de la requête :

- Module.
- Activité.
- Empreinte.
- Version.
- Mode.
- Index de question.
- Réponses.
- Indication d'assistance.

Un rejeu identique doit retourner le résultat précédemment enregistré sans effet supplémentaire.

Un identifiant réutilisé avec un contenu différent doit produire un conflit explicite.

Tester :

- Double clic.
- Rejeu HTTP.
- Rejeu hors ligne.
- Deux appareils.
- Plusieurs onglets.
- Réponse réseau perdue.
- Réutilisation d'identifiant.
- Requête modifiée.

Définir une période de compatibilité pour les anciennes versions de l'application qui n'envoient pas encore d'identifiant ou d'empreinte.

Ne pas casser les opérations anciennes déjà enregistrées hors ligne.

## 16. Gestion des versions pédagogiques

Garantir qu'une réponse est corrigée à partir du contenu réellement utilisé.

Ne pas confondre la version actuelle avec celle jouée auparavant.

Lorsqu'une activité est modifiée :

- Identifier la version réellement jouée.
- Conserver la tentative historique.
- Appliquer la politique de compatibilité définie.
- Ne pas recorriger silencieusement avec une nouvelle question.
- Ne pas attribuer de maîtrise injustifiée.
- Permettre de reprendre une expérience compatible.

Si une ancienne partie n'est plus compatible, conserver temporairement son historique et présenter un message court.

Exemple : « Cette activité a été mise à jour. »

Proposer une action pertinente.

Ne pas perdre silencieusement la progression.

Vérifier les risques de concurrence entre une publication et un enregistrement de résultat.

Évaluer une empreinte canonique robuste pour les contenus.

Ne pas considérer une simple empreinte courte comme un mécanisme de sécurité.

## 17. Identifiants stables des contenus

Préserver les nouveaux identifiants `lesson_key`.

Vérifier leur comportement lors :

- D'un renommage.
- D'une réorganisation.
- D'une duplication.
- D'une nouvelle version.
- D'une suppression.
- D'une restauration.
- D'une modification majeure.

La reprise des anciennes leçons par leur titre comporte des limites : ne pas inventer une correspondance lorsqu'elle est ambiguë.

Distinguer la conservation de l'historique et le besoin de redécouvrir un contenu substantiellement modifié.

Appliquer une logique similaire aux activités pédagogiques lorsque nécessaire.

## 18. Badges et récompenses

Préserver `learning_badges` et les mécanismes d'attribution idempotente.

Vérifier que :

- Un badge acquis ne disparaît jamais après une erreur.
- Sa date d'obtention est fiable.
- Une même tentative ne l'attribue pas plusieurs fois.
- Le badge Persévérance nécessite de véritables difficultés avant la maîtrise.
- Les anciennes données ambiguës ne créent pas artificiellement de récompenses.
- Les anciennes attributions restent traçables.

Vérifier les transactions et les accès concurrents.

Les badges doivent être numériques et distincts des insignes scouts officiels.

## 19. Maîtrise pédagogique et réponses assistées

Distinguer clairement :

- Activité parcourue.
- Activité terminée.
- Réponse correcte.
- Réponse correcte avec assistance.
- Réponse autonome.
- Connaissance maîtrisée.
- Compétence officiellement validée.

Un joker ou un indice ne doit pas permettre de déclarer automatiquement une notion maîtrisée.

Le jeu de mémoire peut enregistrer une pratique, mais sa réalisation ne doit pas être assimilée mécaniquement à une maîtrise complète.

Une mise en situation ouverte ne doit pas être notée arbitrairement.

Les réponses d'entraînement sont accessibles volontairement : ne pas prétendre garantir une intégrité équivalente à celle d'une évaluation officielle.

Ne jamais utiliser les données ludiques comme autorité sur les étapes Route.

## 20. Révisions espacées

Conserver et enrichir la méthode Leitner existante.

Vérifier :

- Les échéances.
- Les fuseaux horaires.
- Les révisions prématurées.
- Les erreurs.
- Les activités assistées.
- Les contenus retirés.
- Les contenus modifiés.
- Les activités indisponibles.
- La sélection des notions réellement accessibles.

Éviter qu'une activité obsolète bloque les révisions valides.

Ne pas compter plusieurs fois la même tentative.

Permettre de comprendre simplement les notions à revoir sans afficher les détails algorithmiques.

## 21. Disponibilité des jeux

Conserver et améliorer `isPlayable`, `playableModes` et `dueInBank`.

Centraliser les conditions de disponibilité.

Un jeu ne doit être proposé que s'il possède suffisamment de contenu compatible.

Vérifier notamment L'Ascension, le jeu de mémoire, le défi express et les révisions.

Utiliser les mêmes règles dans :

- L'accueil.
- Les modules.
- La bibliothèque.
- La salle des défis.
- Les expéditions.

Ne pas afficher des boutons qui conduisent à des expériences impossibles.

---

# PARTIE IV — DIRECTION ARTISTIQUE ET IMMERSION

## 22. Identité visuelle Tesla

Conserver le nom Nikola Tesla Académie et son identité.

Respecter :

- Le rouge de la branche Route.
- Les couleurs sable.
- L'identité de la Communauté Nikola Tesla.
- Le District Requin de Sable.
- Les logos et symboles existants.

Créer un univers visuel original inspiré de l'aventure, de l'exploration, des camps, des sentiers, des carnets, des boussoles et de la vie scoute.

Prendre en compte le contexte ivoirien et africain.

Éviter une représentation exclusivement européenne du scoutisme.

Créer une expérience mature destinée aux adolescents et jeunes adultes.

Ne pas infantiliser les routiers.

Ne pas copier Duolingo, Kahoot ou des jeux existants.

S'en inspirer uniquement pour comprendre leurs mécaniques d'interaction.

## 23. Illustrations originales

Enrichir les interfaces avec des illustrations pertinentes.

Privilégier :

- Des SVG optimisés.
- Des illustrations vectorielles originales.
- Des ressources locales.
- Des images compressées.
- Des scènes réutilisables.

Créer une bibliothèque graphique cohérente.

Chaque illustration doit avoir une fonction narrative, pédagogique ou immersive.

Ne pas utiliser des images génériques uniquement pour décorer.

Ne pas télécharger automatiquement toutes les ressources.

Vérifier leur fonctionnement hors ligne.

## 24. Design system et animations

Conserver le design system existant et ses tokens.

Enrichir les animations sans introduire de dépendances lourdes inutiles.

Prévoir :

- Micro-interactions.
- Transitions entre les séquences.
- Progression sur les sentiers.
- Déplacement dans les paysages.
- Révélation des indices.
- Retournement des cartes.
- Réponses.
- Réussites.
- Erreurs.
- Déblocage des accomplissements.
- Fin d'expédition.
- Chargements.
- Toasts.
- Synchronisation.

Chaque animation doit avoir une fonction.

Ne pas ralentir une action pour imposer une animation.

Éviter les confettis après chaque réponse correcte.

Utiliser des animations performantes, notamment transform et opacity lorsque pertinent.

Respecter prefers-reduced-motion.

Conserver les préférences d'accessibilité.

Prévoir une qualité graphique adaptée aux capacités des appareils.

## 25. Compagnon d'aventure

Étudier la création d'un compagnon graphique original inspiré du Requin de Sable.

Il doit être mature, sympathique, discret et cohérent avec l'identité de Tesla.

Il peut intervenir :

- Lors de la première connexion.
- Lors de la découverte d'un jeu.
- Pendant une explication nécessaire.
- Après une difficulté.
- Lors d'un accomplissement important.

Il ne doit pas parler en permanence.

Il ne doit pas devenir un assistant conversationnel omniprésent.

Il ne doit pas occuper inutilement l'écran.

Prévoir une possibilité de désactivation.

Ne pas utiliser une API d'IA pour animer artificiellement ce compagnon.

---

# PARTIE V — ACCUEIL ET NAVIGATION

## 26. Accueil routier

Conserver l'accueil simplifié déjà implémenté.

L'améliorer graphiquement et fonctionnellement.

Structure cible :

- Un en-tête compact.
- Une aventure à reprendre.
- Une action principale.
- Au plus une suggestion secondaire.
- Une information communautaire uniquement si pertinente.

L'accueil doit proposer la prochaine action réellement utile.

Il doit pouvoir reprendre :

- Une leçon.
- Un jeu.
- Une expédition.
- Une révision.
- Une préparation de mission.

Les exigences officielles urgentes restent prioritaires.

Ne pas afficher simultanément tous les XP, badges, missions, jeux, modules et statistiques.

Ne pas créer un tableau de bord administratif déguisé.

## 27. Navigation mobile

Conserver une barre inférieure simple.

Auditer les destinations actuelles et leurs libellés.

Maximum cinq destinations principales.

Ne pas ajouter une rubrique spécifique pour chaque nouvelle fonctionnalité.

Les expéditions peuvent être intégrées à Cours ou Explorer.

Les jeux restent dans Défis.

Les missions peuvent être intégrées aux activités ou au parcours.

Les récompenses et favoris peuvent être intégrés au carnet.

Préserver les permissions et les routes existantes.

Respecter les safe areas et le clavier mobile.

Les boutons doivent être placés de manière logique et facilement accessibles.

## 28. Mode concentration

Pendant une leçon, un jeu ou une expédition, masquer les éléments non essentiels.

Conserver :

- Une action de retour.
- Une progression compacte.
- Le contenu.
- Les interactions nécessaires.
- Une action principale.

Ne pas afficher la navigation générale lorsqu'elle perturbe l'immersion.

Ne pas afficher les statistiques globales pendant une partie.

L'utilisateur doit pouvoir quitter et reprendre facilement.

## 29. États vides et erreurs

Les états vides doivent être utiles.

Ne pas afficher de longues explications.

Proposer une action pertinente lorsque possible.

Exemples :

- Aucun défi compatible : explorer les cours.
- Révision terminée : continuer une aventure.
- Aucun contenu téléchargé : choisir un module.
- Résultat en attente : réessayer si nécessaire.

Préserver les messages indispensables à la sécurité, aux règles officielles et à la compréhension des erreurs.

---

# PARTIE VI — VÉRITABLE CARTE D'AVENTURE

## 30. Repenser AdventureTrail

Auditer `adventure-trail.tsx`.

La représentation actuelle repose essentiellement sur une liste verticale avec des cercles et des lignes pointillées.

Je veux une véritable expérience visuelle d'exploration.

Créer une carte ou un sentier illustré comportant :

- Des destinations.
- Des haltes.
- Des chemins sinueux.
- Des points d'intérêt.
- Des paysages.
- Des éléments de découverte.
- Des états de progression réels.
- Une destination finale.

Prévoir plusieurs compositions visuelles réutilisables selon les modules.

Ne pas fabriquer de faux lieux ou de fausses informations pédagogiques.

Les décors peuvent être symboliques et clairement présentés comme tels.

## 31. Ergonomie de la carte

La carte doit rester utilisable sur un petit écran.

Ne pas imposer un défilement excessif.

Prévoir un accès rapide à la halte actuelle.

La carte doit s'adapter au nombre réel de leçons.

Conserver impérativement une vue liste classique.

Ne pas verrouiller artificiellement les cours publiés.

Les utilisateurs doivent pouvoir accéder directement à une leçon.

Les XP et badges ne constituent jamais des conditions d'accès aux contenus officiels.

## 32. Progression visuelle

Montrer uniquement les états utiles :

- Halte à découvrir.
- Halte commencée.
- Halte parcourue.
- Défi disponible.
- Expédition terminée.

Distinguer les états officiels lorsque nécessaire.

Ne pas mélanger progression ludique et progression Route.

Utiliser des animations discrètes pour matérialiser la progression.

---

# PARTIE VII — PERFECTIONNEMENT DES JEUX

## 33. Moteur commun

Conserver les registres existants et les moteurs de jeu.

Ne pas multiplier les systèmes parallèles.

Séparer correctement :

- Les contenus.
- La sélection des exercices.
- Les règles.
- Les états de partie.
- Le rendu.
- Les interactions.
- La sauvegarde.
- Les résultats.
- Les récompenses.
- La synchronisation.

Créer des contrats communs réutilisables pour les nouveaux modes.

Chaque jeu doit avoir une mécanique pédagogique réelle.

Ne pas créer plusieurs jeux qui sont simplement le même questionnaire avec des couleurs différentes.

## 34. L'Ascension

L'Ascension doit devenir l'un des jeux emblématiques de Tesla.

Conserver et enrichir `ascension-landscape.tsx`.

Créer une véritable sensation d'ascension :

- Paysage évolutif.
- Paliers visuels.
- Progression sur le terrain.
- Ambiance graphique.
- Transitions.
- Suspense maîtrisé.
- Jokers.
- Accomplissement final.

Améliorer la disposition des réponses.

Les jokers doivent être immédiatement compréhensibles.

Prévoir les indices, l'élimination de propositions et les questions de remplacement uniquement dans les entraînements autorisés.

Le joueur doit pouvoir reprendre une partie à son état exact.

Ne pas copier l'habillage ou les musiques d'une émission existante.

## 35. Difficulté réelle

La difficulté doit réellement évoluer.

Enrichir le schéma et l'éditeur avec une difficulté pédagogique facultative.

Proposer une échelle simple, par exemple :

- Découverte.
- Intermédiaire.
- Approfondissement.

Déterminer les paliers selon les difficultés disponibles.

Ne pas prétendre qu'une partie possède une difficulté progressive lorsque les questions sont seulement mélangées.

Prévoir des questions de réserve compatibles avec chaque palier.

Ne pas inventer automatiquement une difficulté éditoriale non vérifiée.

## 36. Variété des sessions

Améliorer la sélection des exercices.

Tenir compte :

- Des révisions dues.
- Des notions difficiles.
- Des activités récemment jouées.
- Des questions récemment rencontrées.
- Des connaissances déjà maîtrisées.
- De la diversité des leçons.
- De la difficulté.

Conserver une sélection stable pendant une partie.

Éviter de présenter exactement les mêmes questions lors de deux parties successives lorsque la banque le permet.

Lorsque la banque est limitée, ne pas inventer de nouvelles questions pour remplir artificiellement les sessions.

## 37. Jeu de mémoire

Améliorer :

- Le dos des cartes.
- Les animations.
- La lisibilité des cartes retournées.
- La disposition responsive.
- La découverte des paires.
- Le feedback visuel.
- La reprise.
- La difficulté.

Adapter la grille aux petits écrans.

Ne pas tronquer des informations pédagogiques importantes.

Prévoir une alternative accessible aux animations de retournement.

Éviter une compétition inutile sur le nombre d'essais.

## 38. Frise chronologique

Transformer les remises en ordre historiques en véritables frises interactives lorsque le contenu s'y prête.

Prévoir :

- Des événements.
- Des repères temporels.
- Des illustrations pertinentes.
- Un déplacement intuitif.
- Une validation.
- Une explication.
- Une correction pédagogique en entraînement.

Le glisser-déposer doit rester facultatif.

Prévoir une manipulation au clavier et au toucher sans geste complexe.

Distinguer une véritable chronologie d'une liste simplement numérotée.

## 39. Associations

Créer une expérience visuelle claire permettant de relier des éléments.

Améliorer :

- Les zones de sélection.
- Les associations réussies.
- Les corrections.
- Les animations.
- La lisibilité.
- L'accessibilité.

Ne pas rendre l'interaction difficile pour obtenir artificiellement un effet de jeu.

## 40. Flashcards

Améliorer :

- Le retournement.
- La navigation.
- La mémorisation.
- La maîtrise ressentie.
- Les révisions.
- La reprise.

Permettre au routier de distinguer une notion connue d'une notion à revoir.

Ne pas présenter les flashcards comme des évaluations officielles.

## 41. Textes à compléter

Améliorer le confort de mémorisation.

Prévoir selon le contenu :

- Des mots à choisir.
- Des mots à saisir.
- Une révélation progressive.
- Des indices facultatifs.
- Un retour au texte complet.

Respecter le texte original.

Pour les prières, promesses et textes officiels, privilégier la mémorisation respectueuse.

Ne pas créer de compétition spirituelle.

Auditer l'ensemble du parcours de récompense, y compris le serveur, pour éviter qu'une activité marquée comme respectueuse soit malgré tout notée ou récompensée de manière contradictoire.

## 42. Mises en situation

Transformer les mises en situation en expériences narratives.

Présenter :

- Un contexte.
- Un événement.
- Une décision.
- Des conséquences.
- Une réflexion.

Les scénarios doivent être rédigés ou approuvés par l'encadrement.

Ne pas transformer le discernement, les valeurs ou les choix spirituels en simples questions à réponse unique lorsqu'une appréciation humaine est nécessaire.

## 43. Jeu d'enquête

Créer un véritable mode d'exploration mystère.

Le routier reçoit une mission de découverte.

Il peut consulter progressivement :

- Des indices.
- Des documents.
- Des dates.
- Des symboles.
- Des illustrations.
- Des informations historiques.

Il doit résoudre une énigme pédagogique.

Exemples :

- Identifier une personnalité historique.
- Reconstituer un événement.
- Comprendre un symbole.
- Retrouver les éléments d'un texte.
- Résoudre une situation liée à la vie scoute.

L'enquête doit proposer une mécanique distincte d'un simple quiz.

Chaque indice doit être utile.

Ne pas ajouter de fausses informations historiques.

Prévoir des indices facultatifs et une solution accessible.

## 44. Quiz narratif et défi express

Enrichir les jeux séquentiels existants.

Créer un enchaînement plus naturel entre les questions.

Le défi express doit permettre de commencer rapidement, sans configuration complexe.

Le quiz narratif doit posséder un contexte et une progression cohérente.

Ne pas imposer de chronomètre en entraînement.

Ne pas afficher des informations inutiles entre chaque question.

## 45. Salle des défis

Conserver la simplicité de la salle des défis.

Éviter une présentation uniforme ressemblant à un menu administratif.

Créer une identité graphique distinctive pour les jeux principaux.

Privilégier :

- Une illustration.
- Un nom.
- Une action directe.
- Un détail uniquement si nécessaire.

Ne pas afficher dix grandes cartes volumineuses simultanément.

Mettre en avant une expérience pertinente.

Les autres jeux restent accessibles dans une présentation compacte.

N'afficher que les jeux réellement disponibles.

---

# PARTIE VIII — EXPÉDITIONS PÉDAGOGIQUES

## 46. Concept central

Les expéditions pédagogiques constituent une évolution majeure de Tesla.

Elles doivent permettre au routier d'enchaîner plusieurs expériences cohérentes autour d'un thème.

Une expédition peut associer :

- Des leçons existantes.
- Des blocs interactifs.
- Des histoires.
- Des exercices.
- Des jeux.
- Des enquêtes.
- Des mises en situation.
- Des synthèses.
- Des missions réelles.

Ne pas créer une copie des cours.

Réutiliser les contenus versionnés et publiés.

Une expédition doit avoir un objectif pédagogique précis.

## 47. Exemple d'expédition

Thème : aux origines du scoutisme.

Séquence possible :

1. Découverte du contexte historique.
2. Exploration des personnages.
3. Lecture interactive.
4. Frise chronologique.
5. Enquête historique.
6. Jeu d'association.
7. L'Ascension.
8. Synthèse.
9. Proposition d'une mission réelle.

Cette séquence est illustrative.

Construire les expériences à partir des contenus effectivement disponibles et approuvés.

Ne pas inventer de contenu pour compléter artificiellement le parcours.

## 48. Continuité

L'utilisateur doit pouvoir enchaîner les expériences sans revenir au menu après chaque activité.

Prévoir :

- Une progression globale.
- Une prochaine action claire.
- Des transitions.
- Des points d'arrêt naturels.
- Une sauvegarde complète.
- Une reprise immédiate.
- Des étapes facultatives lorsque pertinent.

Ne pas obliger le routier à terminer l'expédition en une seule fois.

L'expérience peut durer quelques minutes ou être prolongée volontairement.

## 49. Adaptation des expéditions

Permettre une adaptation déterministe à la progression réelle.

Si le routier connaît déjà une notion, une révision courte peut être proposée.

S'il rencontre une difficulté, proposer une explication ou un entraînement approprié.

Ne pas modifier arbitrairement les contenus obligatoires.

Ne pas introduire une IA générative indispensable au fonctionnement.

## 50. Première expédition de référence

Avant de généraliser, réaliser une première expédition entièrement aboutie.

Elle doit démontrer :

- La qualité graphique.
- La narration.
- Les mécaniques de jeu.
- La continuité.
- La sauvegarde.
- Le hors ligne.
- L'accessibilité.
- La simplicité.
- La valeur pédagogique.

Utiliser cette expérience comme référence pour les autres modules.

Préférer une expédition excellente à dix expéditions incomplètes.

---

# PARTIE IX — CONTENUS ET ÉDITEUR PÉDAGOGIQUE

## 51. Audit du catalogue

Analyser l'ensemble des modules disponibles dans le dépôt et, lorsque possible, dans une base locale autorisée.

Évaluer :

- Les contenus existants.
- Les sources.
- Les leçons.
- Les blocs interactifs.
- Les exercices dérivés.
- Les types de jeux compatibles.
- Les difficultés.
- Les explications.
- Les possibilités d'expédition.

Identifier les modules insuffisamment couverts.

Ne pas prétendre connaître le catalogue réel de production si la base n'est pas accessible.

## 52. Préserver le patrimoine pédagogique

Ne pas supprimer ni appauvrir les contenus existants.

Conserver :

- La Loi scoute.
- Les prières.
- La Charte des routiers.
- Les références historiques.
- Les textes officiels.
- Les sources.
- Les versions publiées.

Le lecteur immersif doit toujours permettre d'accéder au contenu intégral.

Ne pas modifier le sens des textes en les découpant.

Ne pas transformer tous les contenus en petits quiz.

## 53. Génération des activités dérivées

Auditer `practice-bank.ts`.

La génération déterministe constitue une bonne approche, mais une liste numérotée n'est pas nécessairement une séquence obligatoire.

Permettre à l'encadrement :

- De prévisualiser les exercices dérivés.
- D'en vérifier la pertinence.
- De les désactiver.
- De les remplacer par une activité rédigée.
- De contrôler les modes compatibles.
- De distinguer les textes nécessitant un traitement respectueux.

Ne pas modifier automatiquement le contenu original.

Les décisions relatives aux exercices dérivés doivent être conservées dans les versions pédagogiques appropriées.

## 54. Enrichissement des banques

Créer ou préparer des activités pédagogiques de qualité à partir des sources existantes.

Diversifier les exercices pour couvrir les notions importantes.

Pour chaque question rédigée, prévoir lorsque pertinent :

- Une formulation claire.
- Une réponse.
- Des propositions plausibles.
- Une explication.
- Une difficulté.
- Une notion associée.
- Une source.
- Les modes de jeu compatibles.

Éviter les questions ambiguës ou répétitives.

Ne pas utiliser les corrigés des évaluations officielles comme banque d'entraînement.

Les nouveaux contenus doivent suivre le workflow d'approbation.

Ne pas publier automatiquement un contenu simplement parce qu'il a été généré.

Les données de démonstration ne doivent jamais devenir la banque pédagogique de production sans validation.

## 55. Éditeur Tiptap

Conserver et améliorer l'éditeur actuel.

Permettre facilement :

- La création de modules.
- L'ajout de leçons aux modules existants.
- La réorganisation.
- La rédaction.
- Les illustrations.
- Les citations.
- Les anecdotes.
- Les frises.
- Les flashcards.
- Les associations.
- Les quiz.
- Les mises en situation.
- Les enquêtes.
- Les blocs narratifs.
- Les synthèses.

Ne pas transformer l'éditeur en outil de programmation complexe.

Les formulaires doivent rester simples.

Les paramètres avancés apparaissent uniquement à la demande.

## 56. Édition des difficultés

Intégrer la saisie de la difficulté dans `practice-form.tsx`.

Permettre une configuration pédagogique compréhensible.

Prévoir des valeurs par défaut lorsque cela est justifié.

Ne pas rendre obligatoire une configuration détaillée pour chaque petite activité.

## 57. Prévisualisation

Permettre aux chefs autorisés de consulter :

- Le rendu classique.
- Le rendu immersif.
- Le rendu mobile.
- Le rendu desktop.
- Le rendu d'un jeu.
- Le rendu d'une expédition.
- Les exercices dérivés.

Le mode aperçu ne doit jamais créer de véritables tentatives ni modifier les statistiques.

Ne pas recourir à une usurpation de compte.

## 58. Modèles réutilisables

Permettre la réutilisation de modèles pédagogiques lorsque cela simplifie la création.

Exemples :

- Leçon historique.
- Activité de mémorisation.
- Mise en situation.
- Enquête.
- Expédition.
- Jeu de révision.

Ne pas créer de duplication incohérente des contenus.

Préserver le versionnement.

## 59. Couverture pédagogique

Introduire si pertinent un indicateur réservé à l'encadrement permettant d'identifier les modules insuffisamment enrichis.

Afficher uniquement les informations utiles à une décision éditoriale.

Ne pas créer un tableau de bord statistique supplémentaire si l'information peut être intégrée à l'éditeur ou à la liste des modules.

Ne pas afficher ces indicateurs aux routiers.

---

# PARTIE X — CARNET ET PERSONNALISATION

## 60. Carnet d'aventure

Enrichir le carnet existant sans le surcharger.

Il peut regrouper progressivement :

- Les accomplissements.
- Les badges.
- Les expéditions réalisées.
- Les découvertes.
- Les favoris.
- Les notes personnelles.
- Les missions.
- Les connaissances à revoir.

Les détails doivent être accessibles à la demande.

Ne pas dupliquer les résultats officiels.

Ne pas afficher toutes les statistiques sur une seule page.

## 61. Favoris

Permettre d'enregistrer des contenus utiles :

- Une leçon.
- Un module.
- Une notion.
- Une activité.
- Une expédition.

L'action doit rester discrète.

Ne pas créer une seconde bibliothèque.

Prévoir une gestion des contenus devenus indisponibles.

## 62. Notes personnelles

Permettre au routier de conserver ses réflexions et notes.

Les notes sont privées par défaut.

Ne pas les rendre automatiquement accessibles aux chefs.

Prévoir :

- Une sauvegarde fiable.
- Une isolation par utilisateur.
- Une synchronisation sécurisée.
- Une gestion des conflits.
- Une suppression autorisée par le titulaire.

Ne pas collecter inutilement des informations privées.

## 63. Accomplissements

Conserver un ensemble limité de badges utiles.

Ne pas créer des dizaines de récompenses.

Créer des illustrations cohérentes et originales.

Les récompenses peuvent être présentées à la fin d'une expérience pertinente.

Ne pas afficher de popup pour chaque XP.

Ne pas créer plusieurs monnaies virtuelles.

Ne pas créer une boutique.

## 64. Avatar et préférences

Permettre une personnalisation facultative et légère.

Proposer :

- Un avatar.
- Des emblèmes approuvés.
- Des préférences d'animation.
- Des sons facultatifs.
- Des vibrations.
- Des options d'accessibilité.

Ne pas rendre la personnalisation obligatoire.

Les sons doivent être désactivables et ne jamais démarrer sans interaction autorisée.

Respecter les préférences existantes.

---

# PARTIE XI — MISSIONS ET VIE SCOUTE

## 65. Missions individuelles

Développer un système de missions en réutilisant les structures existantes.

Exemples :

- Préparer une présentation.
- Découvrir un aspect du scoutisme.
- Mettre en pratique un article de la Loi scoute.
- Préparer une activité.
- Participer à un service.
- Effectuer une réflexion.
- Réaliser un travail d'équipe.

Une mission doit posséder un objectif clair.

Éviter de transformer Tesla en logiciel de gestion de tâches.

## 66. Missions collectives

Exploiter les équipes existantes.

Permettre des missions proposées à :

- Un routier.
- Une équipe.
- La communauté.

Privilégier la coopération.

Ne pas mettre les équipes en compétition permanente.

## 67. Lien avec le programme annuel

Réutiliser le programme annuel et les activités.

Exemples :

- Préparer une Route en Joie.
- Préparer un So'Kraff.
- Préparer un jamboree.
- Préparer un camp.
- Préparer une mission de service.
- Préparer une réunion communautaire.

Associer lorsque pertinent les missions, les cours et les expéditions aux activités existantes.

Ne pas créer de faux événements.

Ne pas dupliquer le calendrier.

## 68. Cycle de vie des missions

Proposition fonctionnelle à vérifier et à valider :

- Mission proposée.
- Mission commencée.
- Mission déclarée réalisée.
- Mission confirmée si nécessaire.

Distinguer les missions libres et celles nécessitant une confirmation.

Les modalités officielles doivent respecter les décisions métier existantes.

Une mission réalisée ne doit jamais créer automatiquement :

- Une présence.
- Un acquis officiel.
- Une validation de compétence.
- Un changement d'étape.
- Une participation à une cérémonie.

Lorsque les règles métier sont absentes, préparer une fonctionnalité désactivée et documenter précisément la décision attendue.

Poursuivre les autres lots.

---

# PARTIE XII — JEUX COLLECTIFS

## 69. Session animée par un chef

Créer une expérience collective proportionnée à la taille de la communauté.

Fonctionnement proposé :

1. Un chef autorisé sélectionne un thème.
2. Il choisit un ensemble de questions d'entraînement.
3. Il crée une session.
4. Un code temporaire est généré.
5. Les participants rejoignent la session.
6. Le chef lance les activités.
7. Les participants jouent.
8. Un bilan pédagogique est disponible.

Prévoir des sessions individuelles et coopératives.

Ne pas utiliser de questionnaires officiels confidentiels.

## 70. Interface animateur

Créer une interface simple.

Le chef doit pouvoir :

- Lancer une session.
- Voir les participants autorisés.
- Démarrer.
- Passer à la suite.
- Mettre en pause lorsque pertinent.
- Terminer.
- Consulter un bilan utile.

Ne pas ajouter une interface complexe de régie.

## 71. Interface participant

Le routier doit pouvoir rejoindre rapidement.

Prévoir :

- Un code.
- Une confirmation.
- Une attente simple.
- Une question ou activité.
- Un feedback.
- La suite.

Masquer les informations non nécessaires.

Ne pas afficher les résultats officiels des autres participants.

## 72. Architecture temps réel

Évaluer les besoins avant d'ajouter WebSocket, SSE ou polling.

Utiliser la solution la plus simple et fiable.

Prévoir :

- Expiration des codes.
- Autorisations serveur.
- Isolation des sessions.
- Reconnexion.
- Déconnexion temporaire.
- Gestion des sessions abandonnées.
- Protection contre les abus.
- Limites raisonnables.
- Journalisation proportionnée.

Ne pas ajouter Redis ou une infrastructure distribuée sans nécessité démontrée.

## 73. Coopération et confidentialité

Privilégier :

- Les objectifs communs.
- Les défis d'équipe.
- La découverte collective.
- Les explications pédagogiques.

Éviter les classements individuels permanents.

Les classements éventuels doivent rester facultatifs et limités aux entraînements autorisés.

Ne pas exposer les notes, les échecs ou les résultats officiels.

Si les règles métier de cette fonctionnalité ne sont pas validées, conserver son activation désactivée par défaut.

---

# PARTIE XIII — ENCADREMENT ET PROGRESSION OFFICIELLE

## 74. Préserver les règles Route

Conserver strictement :

- Le référentiel d'âge.
- La progression officielle.
- Les étapes.
- Les exceptions autorisées.
- Les rattrapages.
- Les notifications de changement d'étape.
- Le parcours antérieur reconnu.
- Les validations humaines.
- Les déblocages.
- La sortie de branche.
- La conversion vers le statut adulte.

Un routier actif ne doit pas être créé avec une étape incohérente.

Les anciennes fiches irrégulières doivent être identifiées et régularisées sans inventer de données.

Aucune activité ludique ne doit modifier directement les étapes Route.

## 75. Tableau communautaire

Auditer la nouvelle page `/administration/parcours` et `pathway-board.tsx`.

Conserver la vision globale des routiers par étape.

Améliorer si nécessaire :

- La lisibilité.
- L'adaptation mobile.
- La navigation entre les étapes.
- L'accès aux fiches.
- Les rattrapages.
- Les échéances.
- Les exceptions.
- Les fiches à régulariser.
- Les filtres par équipe.

Éviter un tableau Kanban horizontal difficile à consulter sur téléphone.

Prévoir une vue mobile appropriée et une vue desktop efficace.

Ne pas permettre de déplacer arbitrairement un routier vers une autre étape par glisser-déposer.

Les étapes restent déterminées par les règles métier.

Vérifier que les compteurs et les fiches présentent les mêmes informations.

## 76. Statistiques de l'encadrement

Les statistiques doivent aider à accompagner les routiers.

Privilégier :

- Les notions difficiles.
- Les rattrapages.
- Les validations en attente.
- Les contenus nécessitant une amélioration.
- Les activités pédagogiques insuffisamment couvertes.
- Les échéances.

Ne pas introduire un suivi intrusif.

Ne pas mesurer la valeur d'un routier par son temps d'écran.

Respecter les seuils de confidentialité.

## 77. Apprenants adultes

Préserver leur accès aux contenus et activités autorisés.

Ne pas leur attribuer :

- Une étape Route fictive.
- Des rattrapages non applicables.
- Des obligations réservées aux routiers.

Adapter l'accueil et les textes à leur situation.

Ils peuvent bénéficier des expériences pédagogiques sans être assimilés artificiellement à des routiers actifs.

## 78. Routiers sans compte

Préserver intégralement les parcours papier.

Conserver :

- Les fiches.
- Les distributions de cours.
- Les impressions.
- Les évaluations papier.
- Les corrections.
- Les résultats.
- Les validations.
- Les rattachements ultérieurs.

Un routier sans compte ne doit jamais être pénalisé dans sa progression officielle.

---

# PARTIE XIV — ÉVALUATIONS ET INTÉGRITÉ PÉDAGOGIQUE

## 79. Séparation entraînement et évaluation

Maintenir une séparation stricte.

L'entraînement permet :

- Les erreurs.
- Les répétitions.
- Les indices.
- Les explications.
- Les jeux.
- Les réponses assistées.

L'évaluation officielle conserve :

- Les conditions d'éligibilité.
- Les tentatives.
- Les versions.
- Les barèmes.
- Les corrections.
- Les validations.
- Les permissions.
- Les restrictions hors ligne.

L'interface peut être immersive, mais le caractère officiel de la tentative doit toujours être compris.

Ne jamais masquer une véritable évaluation sous la forme d'un jeu sans avertissement clair.

## 80. Confidentialité des corrigés

Vérifier que les corrigés officiels ne sont jamais exposés dans :

- La banque d'entraînement.
- Les réponses API non autorisées.
- Le navigateur.
- Les bundles.
- Le service worker.
- Les caches.
- Les paquets hors ligne.
- Les aperçus non autorisés.

Ne pas utiliser les réponses officielles pour enrichir automatiquement les jeux.

## 81. Lecture et compréhension

Distinguer :

- Une leçon ouverte.
- Une leçon parcourue.
- Une leçon travaillée.
- Une notion comprise.
- Une notion maîtrisée.
- Un acquis validé.

Ne pas attribuer une compréhension réelle uniquement parce que l'utilisateur atteint la fin d'un texte.

Ne pas introduire un temps de lecture obligatoire ou une surveillance excessive.

---

# PARTIE XV — OFFLINE-FIRST ET AUTHENTIFICATION

## 82. Fonctionnement hors ligne

Toutes les nouvelles expériences locales doivent être conçues avec le hors ligne dès le départ.

Lorsque les ressources ont été téléchargées :

- Lecture classique.
- Lecture immersive.
- Jeux.
- Enquêtes.
- Révisions.
- Expéditions.
- Favoris.
- Notes.
- Reprise.
- Sauvegardes.
- Consultation des récompenses synchronisées.

Les jeux collectifs nécessitant une communication serveur peuvent rester indisponibles.

Afficher un message contextuel simple.

## 83. Même mot de passe

Préserver l'objectif d'une authentification utilisant le même mot de passe en ligne et hors ligne.

Auditer le fonctionnement réel du coffre existant.

Ne jamais stocker le mot de passe en clair.

Ne pas introduire un deuxième mot de passe inutile.

Vérifier :

- Dérivation des clés.
- Chiffrement.
- Verrouillage.
- Changement de mot de passe.
- Déconnexion.
- Changement de compte.
- Révocation.
- Expiration.
- Réauthentification.

Documenter les limites réelles d'un appareil totalement déconnecté.

Une révocation distante ne peut pas être vérifiée instantanément sans réseau.

## 84. Téléchargements

Permettre le téléchargement ciblé des contenus et ressources nécessaires.

Ne pas imposer le téléchargement de toute l'application pédagogique.

Prévoir :

- Téléchargement.
- Mise à jour.
- Suppression.
- Taille lorsque utile.
- Disponibilité.
- Gestion de l'espace.
- Ressources obsolètes.

Ne jamais supprimer des résultats non synchronisés en nettoyant les ressources téléchargées.

## 85. PWA et service worker

Auditer le service worker.

Vérifier :

- Les routes de jeux.
- Les chunks JavaScript.
- Les ressources graphiques.
- Les nouvelles expéditions.
- Les caches.
- Les changements de version.
- Les anciennes installations.
- La mise à jour de l'application.
- La reprise après fermeture complète.

Vérifier particulièrement la compatibilité avec l'infrastructure réelle OVH, Nginx et Vercel lorsque ces composants sont encore utilisés.

Ne pas présumer que les recettes locales garantissent le fonctionnement en production.

Préparer une recette de préproduction en HTTPS.

---

# PARTIE XVI — SÉCURITÉ ET CONFIDENTIALITÉ

## 86. Permissions

Respecter la matrice de permissions existante.

Toute nouvelle action doit être contrôlée côté serveur.

Auditer :

- Les jeux.
- Les missions.
- Les sessions collectives.
- Les favoris.
- Les notes.
- Les expéditions.
- Les statistiques.
- Les contenus.
- Les récompenses.
- Les synchronisations.

Le masquage d'un bouton n'est pas une autorisation.

Vérifier les accès directs.

## 87. Données personnelles

Collecter uniquement les données nécessaires.

Les réponses d'entraînement, notes et historiques ne doivent pas être conservés indéfiniment sans politique explicite.

Auditer les tables en ajout seul et prévoir une stratégie autorisée de rétention, anonymisation ou suppression lorsque nécessaire.

Préserver l'intégrité des données officielles.

Ne pas exposer les données médicales.

Ne pas stocker de secrets dans les logs.

Ne pas enregistrer tous les clics ou mouvements de souris.

## 88. Protection contre les abus

Vérifier :

- Les identifiants falsifiés.
- Les récompenses dupliquées.
- Les résultats modifiés.
- Les tentatives rejouées.
- Les soumissions excessives.
- Les réponses réseau tardives.
- Les accès intercomptes.
- Les conflits entre appareils.
- Les codes collectifs.
- Les entrées utilisateur.
- Les XSS.
- Les dépendances.

Ne pas considérer le navigateur comme une autorité sur un résultat officiel.

La recorrection serveur des entraînements doit être proportionnée à leur nature non officielle.

## 89. Migrations

Conserver les migrations existantes.

Créer uniquement des migrations additives et justifiées.

Auditer particulièrement :

- `20261125090000_learning_events_practice`
- `20261126090000_practice_attempts_badges`
- Les migrations de progression et de notifications.

Vérifier la reprise des anciennes données.

Tester les migrations depuis une copie de l'ancien schéma.

Tester une installation neuve.

Vérifier les triggers, les index et les contraintes.

Tester la restauration.

Ne pas modifier une migration déjà appliquée de manière incompatible.

Ne jamais migrer la production sans autorisation.

## 90. Audit des dépendances

Exécuter l'audit des dépendances de production précédemment non réalisé.

Analyser les vulnérabilités réellement applicables.

Ne pas mettre à jour arbitrairement l'ensemble des dépendances.

Corriger les problèmes pertinents et vérifier les régressions.

Documenter les vulnérabilités restantes, leur impact et les mesures prises.

---

# PARTIE XVII — PERFORMANCE ET ACCESSIBILITÉ

## 91. Mobile-first

Concevoir prioritairement pour les téléphones utilisés par les routiers.

Tester notamment :

- 320 px.
- 360 px.
- 390 px.
- 430 px.
- 768 px.
- 1024 px.
- 1440 px.

Vérifier les petits écrans, les connexions lentes et les appareils Android modestes.

Ne pas simplement réduire une interface desktop.

## 92. Optimisation

Privilégier :

- SVG optimisés.
- Images WebP ou AVIF.
- Chargement différé.
- Division des bundles.
- Composants légers.
- Préchargement raisonnable.
- Caches adaptés.
- Animations CSS lorsque suffisantes.

Ne pas charger les ressources de tous les jeux dès l'accueil.

Auditer les requêtes API redondantes.

Éviter le recalcul coûteux de toute la banque d'entraînement à chaque petite action.

Évaluer les performances du journal et des statistiques lorsque l'historique augmente.

Prévoir des index et des limites adaptées.

Ne pas introduire une infrastructure de cache distribuée sans besoin démontré.

## 93. Mesures de performance

Comparer avant et après :

- Temps de chargement.
- LCP.
- INP lorsque mesurable.
- CLS.
- Taille des bundles.
- Consommation mémoire.
- Fluidité.
- Volume des requêtes.
- Ressources téléchargées.

Objectifs indicatifs :

- LCP ≤ 2,5 secondes.
- INP ≤ 200 ms.
- CLS ≤ 0,1.

Tester avec et sans cache.

Tester avec réseau lent et CPU ralenti.

Tester des sessions prolongées.

Ne pas présenter une mesure locale comme une garantie sur tous les appareils.

## 94. Accessibilité

Respecter WCAG 2.2 AA lorsque applicable.

Vérifier :

- Contrastes.
- Navigation clavier.
- Focus.
- Lecteurs d'écran.
- Zones tactiles.
- Réduction des animations.
- Alternatives aux gestes.
- Textes alternatifs.
- Feedback non dépendant uniquement de la couleur.
- Lisibilité.
- Absence de contenu tronqué.

Les animations graphiques doivent avoir une solution de repli.

Ne pas considérer un audit automatisé sans violation comme une validation complète de l'accessibilité.

---

# PARTIE XVIII — TESTS ET RECETTE

## 95. État des tests précédents

Le précédent chantier déclarait notamment :

- API : 312 tests unitaires réussis.
- Web : 179 tests unitaires réussis.
- Intégration entraînement : 10 tests réussis.
- Lint et typecheck réussis.

Les vérifications suivantes n'avaient pas été exécutées à la fin de ce chantier :

- Build complet.
- Intégration PostgreSQL complète.
- Recettes navigateur actualisées.
- Audit des dépendances de production.
- Mesures avant/après.
- Recettes sur téléphones réels.

Revérifier l'état actuel.

Ne pas supposer que ces résultats sont encore valides.

## 96. Tests de référence

Exécuter avant les modifications les commandes réellement disponibles.

Notamment :

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:int -w @tesla/api
npm run audit:prod
```

Adapter les commandes aux scripts et versions réellement présents.

Respecter la version Node du projet.

Utiliser uniquement des bases isolées.

Ne pas utiliser une base réelle de production.

Documenter les échecs préexistants.

## 97. Tests de sauvegarde

Tester tous les jeux et expériences avec :

- Actualisation.
- Fermeture.
- Réouverture.
- Changement de jour.
- Changement de compte.
- Deux onglets.
- Deux appareils lorsque applicable.
- Perte réseau.
- Erreur serveur.
- Coffre indisponible.
- Échec de sauvegarde.
- Stockage insuffisant.
- Publication d'une nouvelle version.

Vérifier que les données personnelles ne sont pas exposées.

## 98. Tests de synchronisation

Tester :

- Double envoi.
- Rejeu.
- Concurrence.
- Identifiant modifié.
- Réponse perdue.
- Échec temporaire.
- Refus définitif.
- Expiration de session.
- Reconnexion.
- File importante de résultats.
- Synchronisation après fermeture.

Aucun résultat valide ne doit être silencieusement perdu.

## 99. Tests pédagogiques

Vérifier :

- La notation.
- Les réponses assistées.
- Les jokers.
- Les badges.
- Les révisions.
- Les contenus obsolètes.
- Les activités retirées.
- La difficulté.
- Les exercices dérivés.
- La lecture.
- Les expéditions.
- Les évaluations officielles.
- Les corrections humaines.
- Les parcours papier.

## 100. Recette visuelle obligatoire

Utiliser Playwright ou un navigateur réel.

Ne pas se limiter aux tests unitaires.

Effectuer des captures avant et après.

Vérifier notamment :

- L'accueil.
- La navigation.
- La bibliothèque.
- La carte d'aventure.
- Les leçons.
- L'Ascension.
- Le jeu de mémoire.
- Les flashcards.
- Les frises.
- Les associations.
- Les textes à compléter.
- Les enquêtes.
- Les mises en situation.
- Les expéditions.
- Le carnet.
- Les missions.
- Les sessions collectives.
- L'éditeur.
- Le tableau communautaire.
- Les pages hors ligne.
- Les écrans d'erreur.

Inspecter réellement les captures.

Vérifier les animations en mouvement.

Corriger les anomalies.

Relancer les recettes.

Ne pas déclarer une fonctionnalité visuellement validée si elle n'a pas été exécutée dans un navigateur.

## 101. Recette de longue session

Simuler une utilisation prolongée de 60 à 120 minutes.

Enchaîner plusieurs leçons, jeux et expéditions.

Tester :

- La fluidité.
- La consommation mémoire.
- La stabilité.
- Les sauvegardes.
- Les interruptions.
- Le changement de réseau.
- Les retours arrière.
- La cohérence des récompenses.
- La continuité pédagogique.

Ne pas concevoir des mécanismes qui obligent l'utilisateur à rester connecté.

## 102. Recette finale de simplicité

Après toutes les modifications, auditer de nouveau chaque écran.

Pour chacun, répondre :

- Quel est son objectif ?
- Quelle est son action principale ?
- Quelles informations sont indispensables ?
- Quelles informations peuvent être déplacées ?
- Quels éléments se répètent ?
- Quels éléments encombrent l'écran ?
- L'utilisateur comprend-il immédiatement ce qu'il peut faire ?

Supprimer les informations inutiles introduites pendant les travaux.

Cette recette est obligatoire.

---

# PARTIE XIX — ORGANISATION DE L'IMPLÉMENTATION

## 103. Lot 0 — Audit et préparation

- Vérification Git.
- Consolidation.
- Lecture documentaire.
- Reproduction des problèmes.
- Tests de référence.
- Captures initiales.
- Mesures initiales.
- Inventaire des fonctionnalités.

## 104. Lot 1 — Sauvegardes et isolation

- Persistance interne des jeux.
- Sauvegarde des expéditions.
- Réconciliation des sauvegardes.
- Isolation des comptes.
- Concurrence.
- Reprise durable.

## 105. Lot 2 — Résultats et synchronisation

- File persistante.
- Enregistrement avant envoi.
- Synchronisation globale.
- Idempotence complète.
- Versions.
- Gestion des erreurs.
- Reprise.

## 106. Lot 3 — Intégrité pédagogique

- Badges.
- Révisions.
- Maîtrise.
- Réponses assistées.
- Identifiants stables.
- Disponibilité des jeux.
- Variété des sessions.
- Difficulté.

## 107. Lot 4 — Direction artistique

- Identité Tesla.
- Illustrations.
- Animations.
- Design system.
- Accessibilité.
- Composants graphiques réutilisables.

## 108. Lot 5 — Perfectionnement des jeux

- L'Ascension.
- Mémoire.
- Frises.
- Associations.
- Flashcards.
- Textes.
- Scénarios.
- Quiz.
- Enquêtes.

Ne pas introduire des jeux incomplets.

## 109. Lot 6 — Carte et navigation

- Véritable carte d'aventure.
- Accueil.
- Salle des défis.
- Mode concentration.
- Navigation.
- Suppression des informations inutiles.

## 110. Lot 7 — Expéditions

- Moteur d'expéditions.
- Continuité.
- Reprise.
- Première expédition de référence.
- Expériences suivantes.

## 111. Lot 8 — Contenus et éditeur

- Audit pédagogique.
- Activités dérivées.
- Difficultés.
- Nouveaux blocs.
- Modèles.
- Prévisualisation.
- Édition des expéditions.
- Couverture pédagogique.

## 112. Lot 9 — Carnet et personnalisation

- Favoris.
- Notes.
- Accomplissements.
- Historique.
- Avatar.
- Compagnon facultatif.
- Préférences.

## 113. Lot 10 — Missions

- Missions individuelles.
- Missions d'équipe.
- Missions communautaires.
- Lien avec le programme annuel.
- Confirmation lorsque nécessaire.

Les décisions officielles non définies doivent être soumises à validation avant activation.

## 114. Lot 11 — Jeux collectifs

- Session animateur.
- Code temporaire.
- Participants.
- Coopération.
- Reconnexion.
- Sécurité.
- Bilan.

Activation conditionnée aux décisions métier nécessaires.

## 115. Lot 12 — Encadrement

- Tableau communautaire.
- Progression.
- Rattrapages.
- Outils de rédaction.
- Statistiques utiles.
- Simplification des interfaces.

## 116. Lot 13 — Hors ligne

Le hors ligne doit avoir été intégré dès les lots précédents.

Consolider :

- Coffre.
- Authentification.
- Ressources.
- Jeux.
- Expéditions.
- Favoris.
- Notes.
- Synchronisation.
- PWA.

## 117. Lot 14 — Sécurité et performances

- Permissions.
- Confidentialité.
- Dépendances.
- Optimisation.
- Migrations.
- Concurrence.
- Mesures.

## 118. Lot 15 — Recette finale

- Tests complets.
- Build.
- Intégration.
- Recettes navigateur.
- Accessibilité.
- Recette longue.
- Audit final de simplicité.
- Correction des anomalies.
- Documentation.
- Préparation du pilote.

## 119. Méthode de travail

Enchaîner les lots sans demander une validation systématique après chaque étape.

Prioriser les problèmes P0 avant les nouvelles fonctionnalités.

Ne pas s'arrêter après l'audit.

Ne pas s'arrêter après une maquette.

Ne pas déclarer terminé un lot incomplet.

Lorsqu'une décision métier officielle est nécessaire :

- Documenter le besoin.
- Préparer une proposition.
- Maintenir la fonctionnalité désactivée si nécessaire.
- Poursuivre les travaux indépendants.

Ne pas inventer une règle officielle.

Respecter les règles Git du dépôt.

Aucun déploiement en production sans autorisation.

---

# PARTIE XX — DOCUMENTATION ET LIVRAISON

## 120. Suivi persistant

Maintenir un suivi dans :

`docs/TESLA_IMMERSIVE_PROGRESS.md`

Pour chaque lot, documenter :

- Objectif.
- État réel.
- Modifications.
- Tests.
- Anomalies.
- Limites.
- Décisions.
- Prochaine étape.

Préserver le contexte après une compaction ou une interruption.

Ne pas multiplier les documents redondants.

## 121. Documentation

Mettre à jour :

- `CHANGELOG.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/DECISIONS.md`
- `docs/FEATURES/EXPERIENCE_IMMERSIVE.md`
- Les documents réellement concernés.

Maintenir CLAUDE.md suffisamment concis.

## 122. Rapport final

Présenter :

1. État initial des branches.
2. Stratégie de consolidation.
3. Anomalies reproduites.
4. Anomalies corrigées.
5. Fonctionnalités conservées.
6. Fonctionnalités améliorées.
7. Fonctionnalités ajoutées.
8. Informations inutiles supprimées.
9. Modifications de base de données.
10. Sécurité.
11. Permissions.
12. Tests exécutés.
13. Résultats exacts.
14. Captures avant/après.
15. Mesures de performance.
16. Résultats hors ligne.
17. Fonctionnalités non terminées.
18. Décisions métier attendues.
19. Risques résiduels.
20. Conditions de déploiement.

Ne jamais inventer des résultats de tests.

---

# PARTIE XXI — EXPÉRIMENTATION ET RÉUSSITE

## 123. Préparer une expérimentation réelle

Préparer un pilote auprès des routiers volontaires de la Communauté Nikola Tesla.

Vérifier :

- La compréhension de l'interface.
- Le plaisir d'apprendre.
- La mémorisation.
- La compréhension.
- La facilité de reprise.
- La pertinence des jeux.
- La qualité des expéditions.
- L'absence de surcharge.
- La fluidité.
- Le fonctionnement hors ligne.
- La facilité de création pour les chefs.

Collecter des retours qualitatifs.

Ne pas mesurer uniquement le temps passé.

## 124. Engagement sain

Ne pas introduire :

- De vies limitées empêchant d'apprendre.
- De récompenses financières.
- De boutique.
- De classement humiliant.
- De perte de progression pour absence.
- De notifications culpabilisantes.
- De récompenses aléatoires payantes.
- De défilement infini.
- De mécanismes conçus pour prolonger compulsivement une session.

Le routier doit pouvoir s'arrêter librement et reprendre facilement.

## 125. Critères d'acceptation

Tesla sera considérée comme satisfaisante si :

- Les fonctionnalités existantes sont conservées.
- Les contenus pédagogiques sont préservés.
- Les règles Route sont respectées.
- La sauvegarde est fiable.
- Les parties reprennent correctement.
- Les résultats ne sont pas dupliqués.
- Les données sont isolées par compte.
- Les jeux sont réellement agréables.
- Les expéditions sont cohérentes.
- Les animations sont utiles.
- La carte d'aventure est immersive.
- L'interface reste simple.
- Les chefs disposent d'outils efficaces.
- Le hors ligne fonctionne.
- Les permissions sont respectées.
- Les performances sont mesurées.
- Les tests critiques sont exécutés.
- Les recettes visuelles sont réalisées.
- Les décisions métier non validées sont clairement identifiées.

## 126. Interdictions finales

Ne pas ajouter :

- Un réseau social interne.
- Une messagerie supplémentaire sans besoin démontré.
- Une boutique.
- Plusieurs monnaies virtuelles.
- Un assistant IA omniprésent.
- Des classements permanents.
- Des dizaines de statistiques.
- Des badges inutiles.
- Des animations décoratives permanentes.
- Des fonctionnalités factices.
- Des menus dupliqués.
- Des textes techniques dans l'expérience routier.
- Une nouvelle architecture disproportionnée.
- Une refonte générale injustifiée.

## 127. Instruction finale

Le premier chantier a rendu Tesla interactive.

Le deuxième chantier a renforcé ses fondations.

Ce troisième chantier doit faire de Tesla une expérience réellement mémorable, fiable et immersive.

Je veux une application qui ressemble davantage à une aventure pédagogique qu'à un logiciel de formation.

Je veux que les routiers découvrent naturellement le contenu.

Je veux qu'ils puissent jouer pour comprendre et mémoriser.

Je veux que les connaissances acquises trouvent un prolongement dans leur vie scoute.

Je veux que les chefs puissent créer et gérer facilement ces expériences.

Ne privilégie pas la quantité de fonctionnalités.

Privilégie leur qualité, leur cohérence, leur utilité et leur simplicité.

La richesse doit se trouver dans les expériences, pas dans la quantité d'informations affichées.

Commence maintenant par l'audit des branches, la reproduction des anomalies restantes et la fiabilisation des fondations.

Poursuis ensuite tous les lots jusqu'à la recette finale, en respectant les contraintes, les décisions officielles et les règles du dépôt.
