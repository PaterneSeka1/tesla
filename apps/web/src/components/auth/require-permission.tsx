import { type Permission, type SessionUser } from '@tesla/shared';
import { Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { userCan } from '@/lib/navigation';

/**
 * Écran de décision : affiché seulement avec la permission effective (responsable plein en
 * exercice ou délégation). L'API refuse de toute façon l'opération sans cette permission.
 */
export function RequirePermission({
  user,
  permission,
  children,
}: {
  user: Pick<SessionUser, 'permissions'>;
  permission: Permission;
  children: React.ReactNode;
}) {
  if (userCan(user, permission)) return children;
  return (
    <Alert variant="info">
      <Lock aria-hidden />
      <AlertDescription>
        Cette action est réservée au responsable plein en exercice ou à une personne qu’il a
        habilitée par délégation.
      </AlertDescription>
    </Alert>
  );
}
