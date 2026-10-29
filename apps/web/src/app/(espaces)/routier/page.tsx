import { ClipboardCheck, Download } from 'lucide-react';
import { PROGRESSION_STAGES } from '@tesla/shared';
import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { PlannedFeatures, type PlannedFeature } from '@/components/planned-features';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES: PlannedFeature[] = [
  {
    title: 'Lecture hors ligne',
    description: 'Modules téléchargés sur l’appareil pour une lecture sans connexion.',
    icon: Download,
    phase: 'Phase 3',
  },
  {
    title: 'Évaluations accessibles',
    description: 'Évaluations ouvertes selon votre progression ou un déblocage individuel.',
    icon: ClipboardCheck,
    phase: 'Phase 4',
  },
];

export default function RoutierDashboardPage() {
  return (
    <>
      <PageHeading
        title="Tableau de bord"
        description="Votre parcours dans la Branche Route et vos ressources d’apprentissage."
      />
      <Card>
        <CardHeader>
          <CardTitle>Bibliothèque des modules</CardTitle>
          <CardDescription>
            Cours approuvés par le responsable pédagogique, en consultation libre quelle que soit
            votre étape.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/modules">Ouvrir la bibliothèque</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Étapes de la progression routière</CardTitle>
          <CardDescription>
            Référentiel de la Branche Route. Votre étape actuelle s’affichera après la mise en place
            des comptes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRESSION_STAGES.map((stage) => (
              <li key={stage.code} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-tesla-rouge">Étape {stage.order}</p>
                <p className="font-semibold">{stage.name}</p>
                <p className="text-sm text-muted-foreground">{stage.programmeLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">Signe : {stage.badge}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <PlannedFeatures features={FEATURES} />
    </>
  );
}
