import { type ModuleVersionDetail } from '@tesla/shared';
import { Clock, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/format';
import { LessonContent } from './lesson-content';
import { ResourceList } from './resource-list';

/**
 * Contenu exact d'une version, tel qu'il sera publié : utilisé pour l'aperçu des rédacteurs
 * et la révision du responsable.
 */
export function ModuleVersionView({ version }: { version: ModuleVersionDetail }) {
  const moduleResources = version.resources.filter((resource) => resource.lessonId === null);
  return (
    <article className="space-y-6 rounded-lg border bg-white p-4 sm:p-6">
      <header className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap gap-2">
          {version.stage && (
            <Badge variant="secondary">Étape recommandée : {version.stage.name}</Badge>
          )}
          {version.theme && <Badge variant="outline">{version.theme}</Badge>}
          {version.durationMinutes && (
            <Badge variant="outline">
              <Clock aria-hidden />
              {formatDuration(version.durationMinutes)}
            </Badge>
          )}
        </div>
        <h3 className="text-2xl font-semibold text-tesla-bordeaux">{version.title}</h3>
        {version.summary && (
          <p className="whitespace-pre-line text-muted-foreground">{version.summary}</p>
        )}
      </header>

      {version.objectives.length > 0 && (
        <section aria-labelledby={`objectives-${version.id}`} className="space-y-2">
          <h4 id={`objectives-${version.id}`} className="flex items-center gap-2 font-semibold">
            <Target className="size-4 text-tesla-rouge" aria-hidden />
            Objectifs pédagogiques
          </h4>
          <ul className="list-disc space-y-1 pl-6">
            {version.objectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </ul>
        </section>
      )}
      {version.prerequisites && (
        <section className="space-y-1">
          <h4 className="font-semibold">Prérequis</h4>
          <p className="whitespace-pre-line">{version.prerequisites}</p>
        </section>
      )}

      {version.lessons.length === 0 ? (
        <p className="text-muted-foreground italic">Aucune leçon.</p>
      ) : (
        version.lessons.map((lesson, index) => (
          <section key={lesson.id} className="space-y-3 border-t pt-4">
            <h4 className="text-lg font-semibold text-tesla-bordeaux">
              Leçon {index + 1} — {lesson.title}
              {lesson.durationMinutes && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({formatDuration(lesson.durationMinutes)})
                </span>
              )}
            </h4>
            <LessonContent document={lesson.content} />
            {version.resources.some((resource) => resource.lessonId === lesson.id) && (
              <ResourceList
                resources={version.resources.filter((resource) => resource.lessonId === lesson.id)}
              />
            )}
          </section>
        ))
      )}

      {moduleResources.length > 0 && (
        <section className="space-y-2 border-t pt-4">
          <h4 className="font-semibold">Ressources du module</h4>
          <ResourceList resources={moduleResources} />
        </section>
      )}
    </article>
  );
}
