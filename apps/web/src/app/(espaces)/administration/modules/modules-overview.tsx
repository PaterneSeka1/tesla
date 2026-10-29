'use client';

import { useSessionUser } from '@/components/auth/session-gate';
import { RequirePermission } from '@/components/auth/require-permission';
import { EditorModuleList } from '@/components/modules/editor-module-list';

export function ModulesOverview() {
  const user = useSessionUser();
  return (
    <RequirePermission user={user} permission="module.review">
      <EditorModuleList review />
    </RequirePermission>
  );
}
