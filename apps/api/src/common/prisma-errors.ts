import { Prisma } from '../generated/prisma/client.js';

/** Violation d'une contrainte d'unicité (index unique, y compris partiel). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Enregistrement introuvable lors d'une mise à jour conditionnelle (ex. statut modifié entre-temps). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Violation de clé étrangère (ex. étape de progression inexistante). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

/** Texte de diagnostic d'une erreur (message, méta-données, causes), sans l'exposer au client. */
function errorText(error: unknown, depth = 0): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object' || depth > 4) return '';
  const record = error as { message?: unknown; code?: unknown; meta?: unknown; cause?: unknown };
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return [
    text(record.message),
    text(record.code),
    JSON.stringify(record.meta ?? null),
    errorText(record.cause, depth + 1),
  ].join(' ');
}

/** Violation d'une contrainte d'exclusion PostgreSQL (SQLSTATE 23P01), éventuellement nommée. */
export function isExclusionViolation(error: unknown, constraint?: string): boolean {
  const text = errorText(error);
  const exclusion = text.includes('23P01') || text.includes('exclusion constraint');
  return exclusion && (!constraint || text.includes(constraint));
}
