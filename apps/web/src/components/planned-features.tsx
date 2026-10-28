import { type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface PlannedFeature {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Phase de la feuille de route (docs/ROADMAP.md). */
  phase: string;
}

/** Grille des sections d'un tableau de bord dont les données ne sont pas encore disponibles. */
export function PlannedFeatures({ features }: { features: PlannedFeature[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle>{feature.title}</CardTitle>
              <Badge variant="secondary">{feature.phase}</Badge>
            </div>
            <CardDescription>{feature.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={feature.icon}
              title="Aucune donnée"
              description="Cette section sera alimentée lorsque la fonctionnalité sera développée."
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
