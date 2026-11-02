import { queryOptions } from '@tanstack/react-query';
import { medicalRecordSchema, type SaveMedicalRecordInput } from '@tesla/shared';
import { z } from 'zod';
import { env } from '@/lib/env';
import { apiFetch, apiSend } from './client';

// Fiche médicale personnelle (D135–D137) : routes `/me/` jamais conservées sur l'appareil
// (exclusion dans `offline/repository.ts`), jamais rejouées hors ligne, jamais préparées.

export const medicalRecordQueryOptions = queryOptions({
  queryKey: ['me', 'medical-record'],
  queryFn: () => apiFetch('/me/medical-record', medicalRecordSchema, { cache: 'no-store' }),
  // Donnée sensible : pas de conservation en mémoire après la sortie de l'écran.
  gcTime: 0,
});

export const saveMedicalRecord = (input: SaveMedicalRecordInput) =>
  apiSend('PUT', '/me/medical-record', medicalRecordSchema, input);

export const deleteMedicalRecord = (expectedRevision: number) =>
  apiSend('DELETE', '/me/medical-record', z.null(), { expectedRevision });

/** PDF A4 du titulaire connecté (aucun identifiant dans l'adresse). */
export const medicalRecordPdfUrl = () => `${env.NEXT_PUBLIC_API_URL}/me/medical-record/pdf`;
