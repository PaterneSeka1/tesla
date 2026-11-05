# Importer son programme annuel Excel dans Nikola Tesla Académie

Ce guide s'adresse au responsable de la communauté. Il n'est plus nécessaire de convertir le programme en Markdown : le fichier Excel s'importe tel quel.

## Avant de commencer

- Il faut être **responsable en fonction** et **connecté à Internet** (l'import ne fonctionne pas hors connexion).
- Le fichier doit être au format **.xlsx** (Excel, LibreOffice ou Google Sheets : « Enregistrer sous » ou « Télécharger » → .xlsx), sans mot de passe ni macro, et peser moins de 2 Mo.
- Une ligne par samedi. Les colonnes **Date** et **Temps commun / objectif** (ou « Activité ») sont indispensables. Les autres sont facultatives : Axe du mois, Novices Routiers, Aspirants Routiers, Compagnons Routiers, Routiers Confirmés, Format, Responsable, Statut, Présents, Observations, N°, Mois.
- L'ordre des colonnes, les titres et bandeaux au-dessus du tableau et la note en bas de page n'ont pas d'importance.

## Choisir l'année

Ouvrez **Programme annuel**. Si plusieurs années existent, choisissez la bonne dans la liste « Programme ». Pour une nouvelle année, ouvrez **Programmes annuels** en bas de page, remplissez « Nouvelle année » (code `2027-2028`, titre, début, fin) puis **Créer le programme**. Renseigner la période permet à Tesla de signaler les dates hors de l'année.

## Importer

1. Dans **Importer un programme Excel**, cliquez sur le champ **Classeur Excel** et choisissez votre fichier. L'analyse démarre seule ; **rien n'est encore enregistré**.
2. **Feuille** : si le classeur en contient plusieurs, choisissez celle du programme puis **Relancer l'analyse**.
3. **Colonnes reconnues** : vérifiez que chaque colonne correspond au bon champ. Une colonne marquée « Non reconnue » bloque l'import : choisissez ce qu'elle contient ou « Ignorer cette colonne », puis **Relancer l'analyse**.
4. **Anomalies** : chaque problème indique la ligne et la colonne Excel (date invalide, intitulé manquant, doublon…). Le plus simple est de corriger le fichier puis de le choisir à nouveau. Les avertissements (note de bas de page, mois incohérent…) ne bloquent pas.
5. **Séances** : cliquez sur une séance pour voir ce qui sera enregistré, dont les contenus des quatre catégories. Le filtre « Afficher » permet de ne voir que les créations, les mises à jour, etc.
6. **Rapprochements à décider** : quand une ligne ressemble à une séance déjà présente (même date ou même intitulé), choisissez **Mettre à jour cette séance**, **Créer une nouvelle séance** ou **Ignorer cette ligne**, puis **Relancer l'analyse**.
7. Cliquez sur **Confirmer l'import**. Le bilan s'affiche et les séances apparaissent dans le calendrier.

Si quelqu'un a modifié une séance entre l'analyse et la confirmation, Tesla refuse et demande de relancer l'analyse : rien n'est écrasé.

## Ce que l'import ne fait jamais

- Il ne supprime aucune séance : celles qui ne figurent plus dans le fichier sont seulement listées.
- Il ne touche pas aux séances déjà **réalisées, reportées, annulées**, modifiées à la main, ni à celles qui ont des **présences** ou un **compte rendu** : elles sont « Protégées ».
- Le **Statut** du fichier (ex. « Tenue ») est gardé pour information : la séance est créée « Planifiée » et c'est à vous d'enregistrer la réalisation depuis sa fiche.
- Le nombre de **Présents** du fichier n'est jamais transformé en présences nominatives.
- Aucun module n'est publié, aucune évaluation créée, aucun acquis validé.
- Le fichier n'est pas conservé (seuls son nom et une empreinte figurent dans l'historique des imports).

## Mettre à jour le programme en cours d'année

Corrigez votre Excel puis importez-le de nouveau. Les séances inchangées restent « Déjà à jour », les séances simplement planifiées sont mises à jour, les autres sont protégées. Importer deux fois le même fichier ne crée aucun doublon.

## Suivre une séance : prévu et réalisé

Depuis le calendrier ou **Activités**, ouvrez une séance :

- **Programme prévu** : objectif commun, format, responsable prévu, contenus des quatre catégories, observations du programme.
- **Réalisation** : changez le statut (Réalisée, Reportée, Annulée), puis complétez dans **Modifier la préparation et le compte rendu** : responsable effectif, activités menées, objectifs atteints ou non, difficultés, observations de terrain, décisions et suites, compte rendu.
- **Présences** : Présent, Absent ou Excusé pour chaque routier ; « Non renseigné » n'est pas une absence.
- **Prévu / réalisé** : comparaison ligne à ligne (date, responsable, objectifs, activités, effectif, observations).
- **Historique** : import, corrections, reports avec l'ancienne et la nouvelle date, changements de statut.

Un report affiche en tête de fiche : « Initialement prévue le … — Réalisée le … ».

L'ancien import par tableau Markdown reste disponible dans **Importer un tableau Markdown (option secondaire)**.
