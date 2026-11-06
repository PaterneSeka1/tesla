'use client';

import {
  type CreateResourceInput,
  createResourceInputSchema,
  type EditorModuleDetail,
  MODULE_RESOURCE_KIND_LABELS,
  MODULE_RESOURCE_KINDS,
  type ModuleResourceKind,
  STORED_FILE_MIME_TYPES,
  STORED_FILE_TYPES,
} from '@tesla/shared';
import { Link2, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ResourceList } from '@/components/modules/resource-list';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { uploadModuleFile } from '@/lib/api/files';
import { addResource, deleteResource } from '@/lib/api/modules';

/** Types acceptés par nature de ressource (attribut `accept` du sélecteur de fichier). */
const ACCEPT = {
  IMAGE: STORED_FILE_MIME_TYPES.filter((mime) => STORED_FILE_TYPES[mime].kind === 'IMAGE').join(
    ',',
  ),
  DOCUMENT: 'application/pdf',
} as const;

/**
 * Ressources : liens https, vidéos YouTube ou Vimeo, ou fichiers (images, PDF) envoyés directement
 * au stockage objet et vérifiés par le serveur avant de pouvoir être joints (D143).
 */
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
  const [source, setSource] = useState<'url' | 'file'>('url');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const fileKind = kind === 'IMAGE' || kind === 'DOCUMENT' ? kind : null;
  const useFile = fileKind !== null && source === 'file';

  const lessonTitle = (lessonIdValue: string | null) =>
    lessonIdValue ? lessons.find((lesson) => lesson.id === lessonIdValue)?.title : null;

  const create = async () => {
    const base = {
      versionId: module.current.id,
      kind,
      title,
      lessonId: lessonId || null,
      description,
    };
    if (useFile) {
      if (!file) return;
      if (STORED_FILE_TYPES[file.type as keyof typeof STORED_FILE_TYPES]?.kind !== fileKind) {
        setError(
          fileKind === 'IMAGE' ? 'Image PNG, JPEG, WebP ou GIF attendue.' : 'Document PDF attendu.',
        );
        return;
      }
      setError(null);
      const ok = await run(
        async () => {
          try {
            const stored = await uploadModuleFile(module.id, file, setProgress);
            return await addResource(module.id, { ...base, fileId: stored.id });
          } finally {
            setProgress(null);
          }
        },
        { success: 'Fichier ajouté', error: 'Envoi impossible' },
      );
      if (ok) {
        setTitle('');
        setDescription('');
        setFile(null);
        setFileInputKey((value) => value + 1);
      }
      return;
    }
    const input: CreateResourceInput = { ...base, url };
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
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        aria-label={`Retirer la ressource ${resource.title}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title="Retirer cette ressource ?"
                    description={
                      <p>
                        « {resource.title} » sera retirée de ce brouillon. Les versions déjà
                        publiées ne sont pas touchées.
                      </p>
                    }
                    confirmLabel="Retirer"
                    destructive
                    onConfirm={() =>
                      run(() => deleteResource(resource.id), {
                        success: 'Ressource retirée',
                        error: 'Retrait impossible',
                      })
                    }
                  />
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
          {fileKind && (
            <div className="space-y-1">
              <Label htmlFor={`${id}-source`}>Source</Label>
              <NativeSelect
                id={`${id}-source`}
                value={source}
                onChange={(event) => setSource(event.target.value as 'url' | 'file')}
              >
                <option value="url">Adresse https</option>
                <option value="file">Fichier de l’appareil</option>
              </NativeSelect>
            </div>
          )}
          {useFile ? (
            <div className="space-y-1">
              <Label htmlFor={`${id}-file`}>Fichier</Label>
              <Input
                key={fileInputKey}
                id={`${id}-file`}
                type="file"
                accept={ACCEPT[fileKind]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : `${id}-file-hint`}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p id={`${id}-file-hint`} className="text-xs text-muted-foreground">
                {fileKind === 'IMAGE'
                  ? 'PNG, JPEG, WebP ou GIF, 5 Mo maximum.'
                  : 'PDF, 20 Mo maximum.'}{' '}
                Non disponible hors ligne.
              </p>
            </div>
          ) : (
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
          )}
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
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button
              type="button"
              onClick={() => void create()}
              disabled={!title.trim() || (useFile ? !file : !url.trim()) || progress !== null}
            >
              Ajouter la ressource
            </Button>
            {progress && (
              <p role="status" className="text-sm text-muted-foreground">
                {progress}
              </p>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
