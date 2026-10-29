import {
  ACTIVITY_STATUS_LABELS,
  type ActivityStatus,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatus,
  COMPETENCY_STATUS_LABELS,
  type CompetencyStatus,
  type NOT_RECORDED,
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from '@tesla/shared';
import { Badge } from '@/components/ui/badge';

type Variant = 'default' | 'secondary' | 'accent' | 'success' | 'destructive' | 'outline';

const COMPETENCY_VARIANTS: Record<CompetencyStatus, Variant> = {
  NON_EVALUE: 'outline',
  EN_COURS: 'secondary',
  PROPOSE: 'accent',
  ACQUIS: 'success',
  A_RETRAVAILLER: 'destructive',
};

const PROPOSAL_VARIANTS: Record<ProposalStatus, Variant> = {
  EN_ATTENTE: 'accent',
  COMPLEMENT_DEMANDE: 'secondary',
  APPROUVEE: 'success',
  REFUSEE: 'destructive',
  RETIREE: 'outline',
};

const ACTIVITY_VARIANTS: Record<ActivityStatus, Variant> = {
  PLANIFIEE: 'secondary',
  REPORTEE: 'accent',
  REALISEE: 'success',
  ANNULEE: 'outline',
};

const ATTENDANCE_VARIANTS: Record<AttendanceStatus | typeof NOT_RECORDED, Variant> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  EXCUSE: 'secondary',
  NON_RENSEIGNE: 'outline',
};

export function CompetencyStatusBadge({ status }: { status: CompetencyStatus }) {
  return <Badge variant={COMPETENCY_VARIANTS[status]}>{COMPETENCY_STATUS_LABELS[status]}</Badge>;
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={PROPOSAL_VARIANTS[status]}>{PROPOSAL_STATUS_LABELS[status]}</Badge>;
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return <Badge variant={ACTIVITY_VARIANTS[status]}>{ACTIVITY_STATUS_LABELS[status]}</Badge>;
}

export function AttendanceBadge({ status }: { status: AttendanceStatus | typeof NOT_RECORDED }) {
  return <Badge variant={ATTENDANCE_VARIANTS[status]}>{ATTENDANCE_STATUS_LABELS[status]}</Badge>;
}
