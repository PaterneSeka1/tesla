'use client';

import { useSessionUser } from '@/components/auth/session-gate';
import { ResponsableOnly } from '@/components/auth/responsable-only';
import { EditorModuleList } from '@/components/modules/editor-module-list';

export function ModulesOverview() {
  const user = useSessionUser();
  return (
    <ResponsableOnly role={user.role}>
      <EditorModuleList review />
    </ResponsableOnly>
  );
}
