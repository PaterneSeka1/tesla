'use client';

import {
  type CreateResourceInput,
  createResourceInputSchema,
  type EditorModuleDetail,
  MODULE_RESOURCE_KIND_LABELS,
  MODULE_RESOURCE_KINDS,
  type ModuleResourceKind,
} from '@tesla/shared';
import { Link2, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ResourceList } from '@/components/modules/resource-list';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { addResource, deleteResource } from '@/lib/api/modules';

/** Ressources externes (aucun fichier téléversé : liens https, vidéos YouTube ou Vimeo). */
export function ResourcesPanel({
  module,
  editable,
}: {
  module: EditorModuleDetail;
  editable: boolean;
}) {
  const run = useModuleAction();
  const id = useId();
  const { resources, lessons } = module.current;
  const [kind, setKind] = useState<ModuleResourceKind>('LIEN');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lessonTitle = (lessonIdValue: string | null) =>
    lessonIdValue ? lessons.find((lesson) => lesson.id === lessonIdValue)?.title : null;

  const create = async () => {
    const input: CreateResourceInput = {
      versionId: module.current.id,
      kind,
      title,
      url,
      lessonId: lessonId || null,
      description,
    };
    const parsed = createResourceInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ressource invalide.');
      return;
    }
    setError(null);
    const ok = await run(() => addResource(module.id, input), {
      success: 'Ressource ajoutée',
      error: 'Ajout impossible',
    });
    if (ok) {
      setTitle('');
      setUrl('');
      setDescription('');
    }
  };

  return (
    <div className="space-y-4">
      {resources.length === 0 ? (
        <EmptyState icon={Link2} title="Aucune ressource" />
      ) : (
        <ResourceList
          resources={resources.map((resource) => ({
            ...resource,
            description:
              [
                lessonTitle(resource.lessonId) && `Leçon : ${lessonTitle(resource.lessonId)}`,
                resource.description,
              ]
                .filter(Boolean)
                .join(' — ') || null,
          }))}
          actions={
            editable
              ? (resource) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={`Retirer la ressource ${resource.title}`}
                    onClick={() =>
                      void run(() => deleteResource(resource.id), {
                        success: 'Ressource retirée',
                        error: 'Retrait impossible',
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )
              : undefined
          }
        />
      )}
      {editable && (
        <fieldset className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-2">
          <legend className="px-1 text-sm font-medium">Ajouter une ressource</legend>
          <div className="space-y-1">
            <Label htmlFor={`${id}-kind`}>Type</Label>
            <NativeSelect
              id={`${id}-kind`}
              value={kind}
              onChange={(event) => setKind(event.target.value as ModuleResourceKind)}
            >
              {MODULE_RESOURCE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {MODULE_RESOURCE_KIND_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-lesson`}>Rattachement</Label>
            <NativeSelect
              id={`${id}-lesson`}
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
            >
              <option value="">Module entier</option>
              {lessons.map((lesson, index) => (
                <option key={lesson.id} value={lesson.id}>
                  Leçon {index + 1} — {lesson.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-title`}>Titre</Label>
            <Input
              id={`${id}-title`}
              maxLength={150}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-url`}>Adresse</Label>
            <Input
              id={`${id}-url`}
              type="url"
              placeholder="https://…"
              value={url}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              onChange={(event) => setUrl(event.target.value)}
            />
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              Vidéos : YouTube ou Vimeo uniquement.
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor={`${id}-description`}>Description (facultative)</Label>
            <Input
              id={`${id}-description`}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive md:col-span-2">
              {error}
            </p>
          )}
          <div className="md:col-span-2">
            <Button
              type="button"
              onClick={() => void create()}
              disabled={!title.trim() || !url.trim()}
            >
              Ajouter la ressource
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
