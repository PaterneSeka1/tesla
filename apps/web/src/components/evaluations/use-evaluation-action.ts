'use client';

import { useQueryClient } from '@tanstack/react-query';
import { editorEvaluationDetailSchema } from '@tesla/shared';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';

/** Erreurs de concurrence : les données affichées sont périmées et rechargées. */
const STALE_CODES = new Set(['EDIT_CONFLICT', 'ATTEMPT_STATE_CHANGED']);

/**
 * Exécute une action sur une évaluation ou une copie : met à jour le cache avec le questionnaire
 * renvoyé, recharge les listes, affiche le résultat. Un conflit recharge les données du serveur.
 */
export function useEvaluationAction() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return async (
    action: () => Promise<unknown>,
    messages: { success: string; error: string; detail?: string },
  ): Promise<boolean> => {
    try {
      const result = await action();
      const detail = editorEvaluationDetailSchema.safeParse(result);
      if (detail.success) {
        queryClient.setQueryData(['evaluations', 'editor', 'detail', detail.data.id], detail.data);
      }
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast.success(messages.success, messages.detail);
      return true;
    } catch (error) {
      if (error instanceof ApiError && STALE_CODES.has(error.code)) {
        await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      }
      toast.error(messages.error, error instanceof Error ? error.message : undefined);
      return false;
    }
  };
}
