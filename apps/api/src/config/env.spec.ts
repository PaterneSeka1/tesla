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
    expect(env.SESSION_TTL_HOURS).toBe(12);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('désactive Swagger par défaut en production', () => {
    // Clé fictive (32 octets nuls) : la clé des fiches médicales est obligatoire en production.
    const production = {
      ...baseEnv,
      NODE_ENV: 'production',
      MEDICAL_DATA_KEY: Buffer.alloc(32).toString('base64'),
    };
    expect(validateEnv(production).SWAGGER_ENABLED).toBe(false);
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

  describe('stockage objet R2', () => {
    const r2 = {
      R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      R2_ACCESS_KEY_ID: 'id',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'tesla-files-dev',
    };

    it('reste facultatif (fichiers indisponibles sans configuration)', () => {
      const env = validateEnv(baseEnv);
      expect(env.R2_BUCKET_NAME).toBeUndefined();
      expect(env.R2_ENDPOINT).toBeUndefined();
    });

    it('déduit le point d’accès du compte et applique les valeurs par défaut', () => {
      const env = validateEnv({ ...baseEnv, ...r2 });
      expect(env.R2_ENDPOINT).toBe(
        'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
      );
      expect(env.R2_REGION).toBe('auto');
      expect(env.R2_KEY_PREFIX).toBe('development');
      expect(env.R2_SIGNED_URL_EXPIRATION).toBe(300);
      expect(env.R2_UPLOAD_MAX_BYTES).toBe(20 * 1024 * 1024);
    });

    it('refuse une configuration partielle avec un message explicite', () => {
      expect(() => validateEnv({ ...baseEnv, R2_BUCKET_NAME: 'tesla-files-dev' })).toThrow(
        /R2_ACCESS_KEY_ID manquant/,
      );
      expect(() => validateEnv({ ...baseEnv, ...r2, R2_ACCOUNT_ID: undefined })).toThrow(
        /R2_ACCOUNT_ID ou R2_ENDPOINT/,
      );
    });

    it('refuse un nom de compartiment, un préfixe ou une durée invalides', () => {
      expect(() => validateEnv({ ...baseEnv, ...r2, R2_BUCKET_NAME: 'Tesla_Files' })).toThrow();
      expect(() => validateEnv({ ...baseEnv, ...r2, R2_KEY_PREFIX: '../prod' })).toThrow();
      expect(() => validateEnv({ ...baseEnv, ...r2, R2_SIGNED_URL_EXPIRATION: '86400' })).toThrow();
    });

    it('exige https en production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          ...r2,
          NODE_ENV: 'production',
          MEDICAL_DATA_KEY: Buffer.alloc(32).toString('base64'),
          R2_ENDPOINT: 'http://minio.local:9000',
        }),
      ).toThrow(/https/);
    });
  });
});
