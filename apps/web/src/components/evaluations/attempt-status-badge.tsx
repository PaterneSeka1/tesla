import { ATTEMPT_STATUS_LABELS, type AttemptStatus } from '@tesla/shared';
import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<AttemptStatus, React.ComponentProps<typeof Badge>['variant']> = {
  PREPAREE: 'secondary',
  EN_COURS: 'accent',
  A_CORRIGER: 'destructive',
  SOUMISE: 'default',
  VALIDEE: 'success',
  REFUSEE: 'outline',
  ANNULEE: 'outline',
};

/** Statut d'une tentative. « Résultat accepté » n'est jamais une validation officielle d'acquis. */
export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  return <Badge variant={VARIANTS[status]}>{ATTEMPT_STATUS_LABELS[status]}</Badge>;
}
