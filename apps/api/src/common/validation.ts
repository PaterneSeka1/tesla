import { BadRequestException } from '@nestjs/common';
import { type z } from 'zod';

/** Valide une entrée avec un schéma Zod de @tesla/shared ; 400 `VALIDATION_ERROR` sinon. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: result.error.issues[0]?.message ?? 'Données non valides.',
    });
  }
  return result.data;
}
