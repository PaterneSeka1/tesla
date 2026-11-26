import { queryOptions } from '@tanstack/react-query';
import {
  type AddReferenceEntryInput,
  type CreateReferenceCategoryInput,
  managedReferenceSchema,
  referenceCatalogSchema,
  type ReorderReferenceInput,
  type UpdateReferenceCategoryInput,
} from '@tesla/shared';
import { z } from 'zod';
import { apiFetch, apiSend } from './client';

// Référentiel scout (D220). Le catalogue (lecture) passe par le dépôt local comme toute lecture :
// consultable hors ligne une fois chargé. Le contenu des ressources est celui des modules publiés
// (`/modules/:slug/print`), lui aussi conservé sur l'appareil.

export const referenceCatalogQueryOptions = (search = '') =>
  queryOptions({
    queryKey: ['reference', 'catalog', search],
    queryFn: () =>
      apiFetch(
        search ? `/reference?q=${encodeURIComponent(search)}` : '/reference',
        referenceCatalogSchema,
      ),
    staleTime: 5 * 60_000,
  });

export const managedReferenceQueryOptions = queryOptions({
  queryKey: ['reference', 'manage'],
  queryFn: () => apiFetch('/reference/manage', managedReferenceSchema, { cache: 'no-store' }),
});

const idSchema = z.object({ id: z.uuid() });
const okSchema = z.object({ ok: z.literal(true) });

export const createReferenceCategory = (input: CreateReferenceCategoryInput) =>
  apiSend('POST', '/reference/categories', idSchema, input);
export const updateReferenceCategory = (id: string, input: UpdateReferenceCategoryInput) =>
  apiSend('PATCH', `/reference/categories/${id}`, idSchema, input);
export const reorderReferenceCategories = (input: ReorderReferenceInput) =>
  apiSend('POST', '/reference/categories/order', okSchema, input);
export const reorderReferenceEntries = (categoryId: string, input: ReorderReferenceInput) =>
  apiSend('POST', `/reference/categories/${categoryId}/order`, okSchema, input);
export const addReferenceEntry = (input: AddReferenceEntryInput) =>
  apiSend('POST', '/reference/entries', idSchema, input);
export const removeReferenceEntry = (id: string) =>
  apiSend('DELETE', `/reference/entries/${id}`, okSchema);
