import { MODULE_VERSION_STATUS_LABELS, type ModuleVersionStatus } from '@tesla/shared';
import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<ModuleVersionStatus, React.ComponentProps<typeof Badge>['variant']> = {
  BROUILLON: 'secondary',
  SOUMIS: 'accent',
  A_CORRIGER: 'destructive',
  REFUSE: 'outline',
  APPROUVE: 'default',
  PUBLIE: 'success',
  ARCHIVE: 'outline',
};

export function ModuleStatusBadge({ status }: { status: ModuleVersionStatus }) {
  return <Badge variant={VARIANTS[status]}>{MODULE_VERSION_STATUS_LABELS[status]}</Badge>;
}
