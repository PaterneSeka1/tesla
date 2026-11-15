import { type ModuleVersionAction, type ModuleVersionStatus } from '@tesla/shared';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDateTime, fullName } from '@/lib/format';

interface VersionEvent {
  versionId: string;
  action: ModuleVersionAction;
  comment: string | null;
  createdAt: string;
  actor: { firstName: string; lastName: string } | null;
}

/**
 * Situation de retour du responsable sur la version de travail (modules et évaluations) :
 * `pending` (corrections demandées ou refus, action attendue) ou `inProgress` (rédaction reprise
 * après une demande de corrections, pas encore renvoyée). Événements du plus récent au plus ancien.
 */
export function correctionState(
  status: ModuleVersionStatus,
  versionId: string,
  events: VersionEvent[],
): 'pending' | 'inProgress' | null {
  if (status === 'A_CORRIGER' || status === 'REFUSE') return 'pending';
  if (status !== 'BROUILLON') return null;
  const own = events.filter((event) => event.versionId === versionId);
  return own[0]?.action === 'REPRISE' && own[1]?.action === 'CORRECTIONS_DEMANDEES'
    ? 'inProgress'
    : null;
}

/** Retour du responsable mis en avant : motif, version, auteur, date et action à faire. */
export function CorrectionNotice({
  status,
  version,
  versionId,
  events,
  action,
  noun = 'le module',
}: {
  status: ModuleVersionStatus;
  version: number;
  versionId: string;
  events: VersionEvent[];
  action?: React.ReactNode;
  noun?: string;
}) {
  const state = correctionState(status, versionId, events);
  if (!state) return null;
  const inProgress = state === 'inProgress';
  const decision = events.find(
    (event) =>
      event.versionId === versionId &&
      (event.action === 'CORRECTIONS_DEMANDEES' || event.action === 'REFUSEE'),
  );
  return (
    <Alert variant={inProgress ? 'info' : 'destructive'}>
      <CircleAlert aria-hidden />
      <AlertTitle>
        {inProgress
          ? `Corrections à apporter (version ${version})`
          : status === 'A_CORRIGER'
            ? `Corrections demandées sur la version ${version}`
            : `Version ${version} refusée`}
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          {decision?.comment ? (
            <blockquote className="border-l-2 border-current/40 pl-3 whitespace-pre-line text-foreground">
              {decision.comment}
            </blockquote>
          ) : (
            <p>Aucun motif détaillé n’a été saisi.</p>
          )}
          {decision && (
            <p className="text-xs">
              {decision.actor ? `${fullName(decision.actor)}, ` : ''}le{' '}
              {formatDateTime(decision.createdAt)}
            </p>
          )}
          <p>
            {inProgress
              ? `Une fois les corrections faites, vérifiez ${noun} puis envoyez-le de nouveau pour validation.`
              : status === 'A_CORRIGER'
                ? 'Reprenez la rédaction, corrigez les points signalés puis envoyez de nouveau pour validation.'
                : 'Pour continuer, créez une nouvelle version à partir de celle-ci.'}
          </p>
          {action}
        </div>
      </AlertDescription>
    </Alert>
  );
}
