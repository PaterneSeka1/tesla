import { type Eligibility, ELIGIBILITY_LABELS } from '@tesla/shared';
import { Badge } from '@/components/ui/badge';

export function EligibilityBadge({ eligibility }: { eligibility: Eligibility }) {
  return (
    <Badge variant={eligibility.allowed ? 'success' : 'outline'}>
      {ELIGIBILITY_LABELS[eligibility.status]}
    </Badge>
  );
}
