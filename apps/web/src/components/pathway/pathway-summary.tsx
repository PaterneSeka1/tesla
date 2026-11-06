'use client';

import {
  PROGRESSION_STAGES,
  type ScoutPathway,
  THEORETICAL_STAGE_REASON_LABELS,
} from '@tesla/shared';
import { CalendarClock, Flag, Hourglass, Route } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const formatCivilDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const MILESTONE_LABELS = {
  DEBUT_ETAPE: 'Début de la période',
  FIN_ETAPE: 'Échéance de la période',
  SORTIE_BRANCHE: 'Sortie de la branche',
} as const;

const stageName = (code: string) =>
  PROGRESSION_STAGES.find((stage) => stage.code === code)?.name ?? code.toLowerCase();

/** Durée restante lisible (années, mois, jours approximés pour l'affichage seulement). */
function remaining(days: number): string {
  if (days < 31) return `${days} jour${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `environ ${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `environ ${years} an${years > 1 ? 's' : ''}${rest ? ` et ${rest} mois` : ''}`;
}

/**
 * Synthèse du parcours : âge, étape actuelle calculée par l'API selon l'âge (D173), échéances.
 * L'étape n'est jamais saisie ; elle ne valide aucun acquis.
 */
export function PathwaySummary({
  pathway,
  audience,
}: {
  pathway: ScoutPathway;
  audience: 'routier' | 'encadrement';
}) {
  const { age, membership } = pathway;
  const exited = membership.status === 'SORTI';
  return (
    <div className="space-y-3">
      {exited && (
        <Alert variant="info">
          <Flag aria-hidden />
          <AlertDescription>
            {audience === 'routier' ? 'Vous avez atteint' : 'Ce routier a atteint'} la limite d’âge
            de la branche
            {age.branchExitOn ? ` le ${formatCivilDate(age.branchExitOn)}` : ''}. Le dossier, les
            résultats, les études et les acquis sont conservés ; aucune étape n’est attribuée
            automatiquement.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Âge</CardDescription>
            <CardTitle className="text-2xl">
              {age.age === null ? 'Non renseigné' : `${age.age} ans`}
            </CardTitle>
          </CardHeader>
          {age.age === null && (
            <CardContent className="text-sm text-muted-foreground">
              Date de naissance gérée par l’administration.
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Route className="size-4" aria-hidden /> Étape actuelle
            </CardDescription>
            <CardTitle className="text-2xl">{pathway.stage?.name ?? 'Non déterminée'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {THEORETICAL_STAGE_REASON_LABELS[age.reason]}
            {age.period?.endsOn && ` · jusqu’au ${formatCivilDate(age.period.endsOn)} (exclu)`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Hourglass className="size-4" aria-hidden /> Temps restant dans la branche
            </CardDescription>
            <CardTitle className="text-2xl">
              {age.daysUntilExit === null ? (exited ? 'Sorti' : '—') : remaining(age.daysUntilExit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {age.branchExitOn
              ? `Sortie le ${formatCivilDate(age.branchExitOn)}`
              : 'Date de sortie non calculable'}
          </CardContent>
        </Card>
      </div>
      {age.nextMilestone && !exited && (
        <p className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-tesla-bordeaux" aria-hidden />
          <span>
            Prochaine échéance : {MILESTONE_LABELS[age.nextMilestone.kind]}
            {age.nextMilestone.stageCode
              ? ` (${stageName(age.nextMilestone.stageCode)})`
              : ''} le <strong>{formatCivilDate(age.nextMilestone.date)}</strong>.
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Calcul au {formatCivilDate(age.referenceDate)}
        {age.ruleSetVersion ? `, référentiel d’âge ${age.ruleSetVersion}` : ''}. L’étape est
        calculée automatiquement selon l’âge ; la validation des acquis reste une décision du
        responsable.
      </p>
    </div>
  );
}
