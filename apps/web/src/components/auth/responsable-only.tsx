import { type Role } from '@tesla/shared';
import { Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Écran réservé au responsable (l'API refuse de toute façon l'opération aux autres rôles). */
export function ResponsableOnly({ role, children }: { role: Role; children: React.ReactNode }) {
  if (role === 'RESPONSABLE') return children;
  return (
    <Alert variant="info">
      <Lock aria-hidden />
      <AlertDescription>Cette action est réservée au responsable pédagogique.</AlertDescription>
    </Alert>
  );
}
