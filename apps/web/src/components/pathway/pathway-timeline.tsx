import { PATHWAY_STEP_STATUS_LABELS, type PathwayStep } from '@tesla/shared';
import { CheckCircle2, Circle, CircleDot, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCivilDate } from './pathway-summary';

const ICONS = {
  RECONNUE: CheckCircle2,
  TERMINEE: History,
  EN_COURS: CircleDot,
  A_VENIR: Circle,
} as const;

/**
 * Frise du parcours (D181), dans l'ordre pédagogique : étape en cours, étapes reconnues au titre du
 * parcours antérieur, périodes terminées (l'âge ne prouve jamais une cérémonie), étapes à venir.
 * Lecture seule : aucune action ici.
 */
export function PathwayTimeline({ steps }: { steps: readonly PathwayStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Mon parcours">
      {steps.map((step, index) => {
        const Icon = ICONS[step.status];
        const current = step.status === 'EN_COURS';
        return (
          <li
            key={step.stage.id}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex items-start gap-2 rounded-lg border bg-card p-3 text-sm',
              current && 'border-tesla-bordeaux ring-1 ring-tesla-bordeaux',
              step.status === 'A_VENIR' && 'text-muted-foreground',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                step.status === 'RECONNUE' || current ? 'text-tesla-bordeaux' : '',
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-semibold">
                <span className="sr-only">Étape {index + 1} : </span>
                {step.stage.name}
              </p>
              <p>{PATHWAY_STEP_STATUS_LABELS[step.status]}</p>
              {step.recognition?.completedOn && (
                <p className="text-muted-foreground">
                  Terminée le {formatCivilDate(step.recognition.completedOn)}
                </p>
              )}
              {current && step.recognition && (
                <p className="text-muted-foreground">Reconnue antérieurement : à réexaminer.</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
