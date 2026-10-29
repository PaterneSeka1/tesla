'use client';

import { useQuery } from '@tanstack/react-query';
import { type EditorModuleDetail } from '@tesla/shared';
import { UserMinus, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { addCollaborator, chefCandidatesQueryOptions, removeCollaborator } from '@/lib/api/modules';
import { authorName, formatDate, fullName } from '@/lib/format';

/** Auteur et chefs invités ; seuls l'auteur et le responsable gèrent les invitations. */
export function CollaboratorsPanel({ module }: { module: EditorModuleDetail }) {
  const run = useModuleAction();
  const id = useId();
  const manage = module.permissions.canManageCollaborators;
  const candidates = useQuery({ ...chefCandidatesQueryOptions, enabled: manage });
  const [userId, setUserId] = useState('');
  const taken = new Set([
    ...(module.createdBy ? [module.createdBy.id] : []),
    ...module.collaborators.map((c) => c.user.id),
  ]);
  const available = candidates.data?.items.filter((user) => !taken.has(user.id)) ?? [];

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        <li className="rounded-md border bg-white p-3 text-sm">
          <span className="font-medium">{authorName(module.createdBy)}</span>
          <span className="text-muted-foreground"> · auteur</span>
        </li>
        {module.collaborators.map((collaborator) => (
          <li
            key={collaborator.user.id}
            className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm"
          >
            <span className="flex-1">
              <span className="font-medium">{fullName(collaborator.user)}</span>
              <span className="text-muted-foreground">
                {' '}
                · invité par {fullName(collaborator.addedBy)} le {formatDate(collaborator.addedAt)}
              </span>
            </span>
            {manage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  void run(() => removeCollaborator(module.id, collaborator.user.id), {
                    success: 'Collaborateur retiré',
                    error: 'Retrait impossible',
                  })
                }
              >
                <UserMinus aria-hidden />
                Retirer
              </Button>
            )}
          </li>
        ))}
      </ul>
      {manage ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${id}-chef`}>Inviter un chef</Label>
            <NativeSelect
              id={`${id}-chef`}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">
                {available.length ? 'Choisir un chef' : 'Aucun chef disponible'}
              </option>
              {available.map((user) => (
                <option key={user.id} value={user.id}>
                  {fullName(user)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            disabled={!userId}
            onClick={async () => {
              const ok = await run(() => addCollaborator(module.id, { userId }), {
                success: 'Collaborateur invité',
                error: 'Invitation impossible',
              });
              if (ok) setUserId('');
            }}
          >
            <UserPlus aria-hidden />
            Inviter
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seuls l’auteur du module et le responsable gèrent les collaborateurs.
        </p>
      )}
    </div>
  );
}
