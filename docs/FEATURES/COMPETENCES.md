# Compétences et validations officielles

Le responsable administre `/administration/competences` : code, nom, description, domaine libre, étape facultative, critères observables, nombre minimal de preuves, modules associés, ordre et activation. Le référentiel est vide au départ : aucune compétence officielle n'est générée.

Un chef ou le responsable soumet une proposition depuis `/administration/validations/nouvelle`, également accessible depuis une fiche. Les preuves peuvent être une observation consultable, une tentative, une activité avec présence, une étude de module ou un justificatif textuel. Les références doivent concerner le même routier. Plusieurs preuves peuvent être requises par la configuration du référentiel.

Le responsable examine `/administration/validations/[id]` et décide : approuver, demander un complément ou refuser avec motif. L'auteur peut compléter et resoumettre, ou retirer une proposition ouverte. Une approbation ou un refus crée une `CompetencyValidation` distincte du résultat du quiz. Les changements et les preuves sont historisés ; les décisions officielles sont immuables, sauf révocation unique, motivée et journalisée. Une correction ultérieure passe par une nouvelle proposition.

L'API contrôle rôle, auteur, état et révision. Les propositions ouvertes et acquisitions actives ne peuvent pas être dupliquées pour une même compétence et un même profil. Le dossier distingue non évalué, en cours, proposé, acquis et à retravailler. `/mes-competences` présente au routier les acquisitions officielles actives et le référentiel de son étape, sans les échanges internes.

API : `GET/POST /competencies`, `GET/PATCH /competencies/:id`, `GET/POST /competency-proposals`, `GET /competency-proposals/:id`, `POST /competency-proposals/:id/{evidences,resubmit,withdraw,approve,reject,request-complement}`, `POST /competency-validations/:id/revoke` (préfixe `/api/v1`). Les schémas Zod et Swagger précisent les entrées.
