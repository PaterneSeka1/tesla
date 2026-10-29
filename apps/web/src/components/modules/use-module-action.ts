'use client';

import { useQueryClient } from '@tanstack/react-query';
import { editorModuleDetailSchema } from '@tesla/shared';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';

/**
 * Exécute une action éditoriale : met à jour le cache avec le module renvoyé (ou recharge),
 * affiche le résultat. Un conflit de modification (`EDIT_CONFLICT`) recharge les données du serveur.
 */
export function useModuleAction() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return async (
    action: () => Promise<unknown>,
    messages: { success: string; error: string; detail?: string },
  ): Promise<boolean> => {
    try {
      const result = await action();
      const detail = editorModuleDetailSchema.safeParse(result);
      if (detail.success) {
        queryClient.setQueryData(['modules', 'editor', 'detail', detail.data.id], detail.data);
      }
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast.success(messages.success, messages.detail);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
        await queryClient.invalidateQueries({ queryKey: ['modules'] });
      }
      toast.error(messages.error, error instanceof Error ? error.message : undefined);
      return false;
    }
  };
}
