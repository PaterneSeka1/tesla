import { type ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

type SchemaObject = ApiResponseSchemaHost['schema'];

/**
 * Schéma OpenAPI dérivé d'un schéma Zod de @tesla/shared : la documentation Swagger
 * reste alignée sur le contrat réellement validé, sans classe DTO dupliquée.
 * `input` pour un corps de requête (avant transformation), `output` pour une réponse.
 */
export function openApiSchema(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as SchemaObject;
}
