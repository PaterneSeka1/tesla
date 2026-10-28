import { validateEnv } from './env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/tesla',
};

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = validateEnv(baseEnv);
    expect(env.API_PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('désactive Swagger par défaut en production', () => {
    expect(validateEnv({ ...baseEnv, NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
  });

  it('découpe les origines CORS', () => {
    const env = validateEnv({ ...baseEnv, CORS_ORIGINS: 'http://a.test, https://b.test' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuse une URL non PostgreSQL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/tesla' })).toThrow();
  });
});
