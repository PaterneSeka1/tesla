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
