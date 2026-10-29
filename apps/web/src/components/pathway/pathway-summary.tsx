'use client';

import {
  type ScoutPathway,
  STAGE_GAP_LABELS,
  THEORETICAL_STAGE_REASON_LABELS,
} from '@tesla/shared';
import { CalendarClock, Flag, Hourglass, Route } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
 * Synthèse du parcours : étape théorique (âge), étape officielle (décision), écart, échéances.
 * Les notions restent distinctes : l'âge ne valide jamais une étape.
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Âge</CardDescription>
            <CardTitle className="text-2xl">
              {age.age === null ? 'Non renseigné' : `${age.age} ans`}
            </CardTitle>
          </CardHeader>
          {age.age === null && (
            <CardContent className="text-sm text-muted-foreground">
              Date de naissance à renseigner par le responsable.
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Route className="size-4" aria-hidden /> Étape théorique (âge)
            </CardDescription>
            <CardTitle className="text-2xl">{pathway.theoreticalStage?.name ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {THEORETICAL_STAGE_REASON_LABELS[age.reason]}
            {age.period?.endsOn && ` · jusqu’au ${formatCivilDate(age.period.endsOn)} (exclu)`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Étape officiellement validée</CardDescription>
            <CardTitle className="text-2xl">{pathway.officialStage?.name ?? 'Aucune'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={pathway.gap === 'EN_RETARD' ? 'accent' : 'outline'}>
              {STAGE_GAP_LABELS[pathway.gap]}
            </Badge>
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
              ? ` (${age.nextMilestone.stageCode.toLowerCase()})`
              : ''}{' '}
            le <strong>{formatCivilDate(age.nextMilestone.date)}</strong>.
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Calcul au {formatCivilDate(age.referenceDate)}
        {age.ruleSetVersion ? `, référentiel d’âge ${age.ruleSetVersion}` : ''}. L’étape théorique
        est une indication : seule une décision du responsable valide une étape.
      </p>
    </div>
  );
}
