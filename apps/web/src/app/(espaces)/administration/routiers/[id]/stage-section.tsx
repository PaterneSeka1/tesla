'use client';

import { type ScoutProgression, STAGE_CHANGE_KIND_LABELS, type StageChange } from '@tesla/shared';
import { Flag } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

function StageHistory({ changes }: { changes: StageChange[] }) {
  if (changes.length === 0) {
    return <EmptyState icon={Flag} title="Aucune décision antérieure" />;
  }
  return (
    <ol className="space-y-2 text-sm">
      {changes.map((change) => (
        <li key={change.id} className="space-y-1 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {change.from?.name ?? 'Aucune'} → <strong>{change.to?.name ?? 'Aucune'}</strong>
            </span>
            <Badge variant={change.kind === 'CORRECTION' ? 'accent' : 'outline'}>
              {STAGE_CHANGE_KIND_LABELS[change.kind]}
            </Badge>
            {change.correctedByChangeId && <Badge variant="secondary">Corrigée ensuite</Badge>}
          </div>
          <p>{change.reason}</p>
          {change.evidence && (
            <p className="text-muted-foreground">Éléments examinés : {change.evidence}</p>
          )}
          {change.observations && (
            <p className="text-muted-foreground">Observations : {change.observations}</p>
          )}
          {change.ceremonyReference && (
            <p className="text-muted-foreground">Cérémonie : {change.ceremonyReference}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Effet le {formatDate(change.effectiveOn)} · décidé le {formatDateTime(change.decidedAt)}
            {change.decidedBy && ` par ${fullName(change.decidedBy)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Décisions d'étape enregistrées avant le calcul automatique (D173), en lecture seule. L'étape
 * actuelle, calculée selon l'âge, figure dans la carte « Informations » de la fiche.
 */
export function StageSection({ progression }: { progression: ScoutProgression }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Décisions d’étape antérieures</CardTitle>
      </CardHeader>
      <CardContent>
        <StageHistory changes={progression.stageChanges} />
      </CardContent>
    </Card>
  );
}
