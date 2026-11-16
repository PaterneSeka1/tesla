import {
  createObservationInputSchema,
  createScoutProfileInputSchema,
  loginInputSchema,
  OBSERVATION_VISIBILITIES,
  scoutListQuerySchema,
  updateScoutProfileInputSchema,
} from '@tesla/shared';
import { ObservationVisibility } from '../../generated/prisma/enums.js';
import { openApiSchema } from '../../common/openapi.js';

describe('Contrats routiers, équipes, observations', () => {
  it('inscrit un routier sans e-mail ni mot de passe', () => {
    const parsed = createScoutProfileInputSchema.parse({
      firstName: ' Prénom ',
      lastName: 'Fictif',
      birthDate: '2008-01-15',
      joinedAt: '2026-10-01',
      matricule: '',
    });
    expect(parsed).toEqual({
      firstName: 'Prénom',
      lastName: 'Fictif',
      birthDate: '2008-01-15',
      joinedAt: '2026-10-01',
      matricule: null,
    });
    expect(Object.keys(createScoutProfileInputSchema.shape)).not.toContain('email');
    // D181 : sans date de naissance, l'étape ne peut pas être déterminée ; inscription refusée.
    expect(
      createScoutProfileInputSchema.safeParse({ firstName: 'Prénom', lastName: 'Fictif' }).success,
    ).toBe(false);
  });

  it('applique les valeurs par défaut des filtres et refuse une page invalide', () => {
    expect(scoutListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      status: 'active',
    });
    expect(scoutListQuerySchema.parse({ teamId: 'none', page: '2' })).toMatchObject({
      teamId: 'none',
      page: 2,
    });
    expect(scoutListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(scoutListQuerySchema.safeParse({ teamId: 'abc' }).success).toBe(false);
  });

  it('refuse une modification vide', () => {
    expect(updateScoutProfileInputSchema.safeParse({}).success).toBe(false);
    expect(updateScoutProfileInputSchema.parse({ matricule: '' })).toEqual({ matricule: null });
  });

  it('normalise l’e-mail de connexion', () => {
    expect(loginInputSchema.parse({ email: 'Chef@Exemple.TEST', password: 'x' }).email).toBe(
      'chef@exemple.test',
    );
  });

  it('observation : contenu requis, visibilité par défaut encadrement', () => {
    expect(
      createObservationInputSchema.safeParse({ observedOn: '2026-10-01', content: '  ' }).success,
    ).toBe(false);
    expect(
      createObservationInputSchema.parse({
        observedOn: '2026-10-01',
        content: 'Texte',
        category: '',
      }),
    ).toMatchObject({ visibility: 'ENCADREMENT', category: null });
  });

  it('l’enum Prisma ObservationVisibility correspond à @tesla/shared', () => {
    expect(Object.values(ObservationVisibility).sort()).toEqual(
      [...OBSERVATION_VISIBILITIES].sort(),
    );
  });

  it('produit un schéma OpenAPI à partir d’un contrat Zod', () => {
    const schema = openApiSchema(createScoutProfileInputSchema, 'input') as { required?: string[] };
    // D181 : date de naissance obligatoire ; date d'entrée facultative (jamais la date du jour).
    expect(schema.required).toEqual(['firstName', 'lastName', 'birthDate']);
  });
});
