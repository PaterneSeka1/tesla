'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type EditorModuleDetail, lessonDocumentSchema, type ModuleLesson } from '@tesla/shared';
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { LessonContent } from '@/components/modules/lesson-content';
import { LessonEditor } from '@/components/modules/lesson-editor';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import { addLesson, deleteLesson, reorderLessons, updateLesson } from '@/lib/api/modules';
import { formatDateTime, formatDuration, fullName } from '@/lib/format';

/** Leçons ordonnées de la version de travail ; une seule leçon ouverte en édition à la fois. */
export function LessonsPanel({
  module,
  editable,
}: {
  module: EditorModuleDetail;
  editable: boolean;
}) {
  const run = useModuleAction();
  const lessons = module.current.lessons;
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState('');
  const newTitleId = useId();

  // Avertit avant de quitter la page si une leçon n'est pas enregistrée.
  useEffect(() => {
    if (dirty.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setLessonDirty = (id: string, value: boolean) =>
    setDirty((current) => {
      if (current.has(id) === value) return current;
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const move = (index: number, offset: -1 | 1) => {
    const ids = lessons.map((lesson) => lesson.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved!);
    void run(() => reorderLessons(module.id, { versionId: module.current.id, lessonIds: ids }), {
      success: 'Ordre des leçons enregistré',
      error: 'Réorganisation impossible',
    });
  };

  const create = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const ok = await run(() => addLesson(module.id, { versionId: module.current.id, title }), {
      success: 'Leçon ajoutée',
      error: 'Ajout impossible',
    });
    if (ok) setNewTitle('');
  };

  return (
    <div className="space-y-3">
      {lessons.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune leçon"
          description="Un module doit comporter au moins une leçon rédigée avant sa soumission."
        />
      ) : (
        <ol className="space-y-3">
          {lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <LessonCard
                lesson={lesson}
                index={index}
                total={lessons.length}
                editable={editable}
                open={openId === lesson.id}
                onToggle={() => setOpenId(openId === lesson.id ? null : lesson.id)}
                onMove={(offset) => move(index, offset)}
                onDirtyChange={(value) => setLessonDirty(lesson.id, value)}
              />
            </li>
          ))}
        </ol>
      )}
      {editable && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={newTitleId}>Nouvelle leçon</Label>
            <Input
              id={newTitleId}
              maxLength={150}
              placeholder="Titre de la leçon"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void create();
                }
              }}
            />
          </div>
          <Button type="button" onClick={() => void create()} disabled={!newTitle.trim()}>
            <Plus aria-hidden />
            Ajouter la leçon
          </Button>
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  index,
  total,
  editable,
  open,
  onToggle,
  onMove,
  onDirtyChange,
}: {
  lesson: ModuleLesson;
  index: number;
  total: number;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  onMove: (offset: -1 | 1) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const run = useModuleAction();
  const id = useId();
  // Révision sur laquelle repose la saisie locale (contrôle de concurrence optimiste).
  const [base, setBase] = useState(lesson.revision);
  const [title, setTitle] = useState(lesson.title);
  const [duration, setDuration] = useState(
    lesson.durationMinutes ? String(lesson.durationMinutes) : '',
  );
  const [content, setContent] = useState<unknown>(lesson.content);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setBase(lesson.revision);
    setTitle(lesson.title);
    setDuration(lesson.durationMinutes ? String(lesson.durationMinutes) : '');
    setContent(lesson.content);
    setEditorKey((key) => key + 1);
    setDirty(false);
    setConflict(false);
    setError(null);
  };

  // Leçon modifiée par une autre personne et aucune saisie locale : affichage de la version du serveur.
  if (!dirty && lesson.revision !== base) reset();

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const markDirty = () => {
    setDirty(true);
    setError(null);
  };

  const save = async () => {
    const parsed = lessonDocumentSchema.safeParse(content);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Contenu invalide.');
      return;
    }
    const minutes = duration.trim() === '' ? null : Number(duration);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 6000)) {
      setError('Durée : nombre entier de minutes entre 1 et 6 000.');
      return;
    }
    if (!title.trim()) {
      setError('Le titre est requis.');
      return;
    }
    setSaving(true);
    try {
      await updateLesson(lesson.id, {
        revision: base,
        title: title.trim(),
        durationMinutes: minutes,
        content: parsed.data,
      });
      setBase(base + 1);
      setDirty(false);
      toast.success('Leçon enregistrée', title.trim());
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.code === 'EDIT_CONFLICT') setConflict(true);
      else setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    run(() => deleteLesson(lesson.id, lesson.revision), {
      success: 'Leçon supprimée',
      error: 'Suppression impossible',
    });

  return (
    <article className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-2 p-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tesla-sable text-sm font-semibold text-tesla-bordeaux">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium">{lesson.title}</h4>
          <p className="text-xs text-muted-foreground">
            {lesson.durationMinutes ? `${formatDuration(lesson.durationMinutes)} · ` : ''}
            Modifiée le {formatDateTime(lesson.updatedAt)}
            {lesson.updatedBy && ` par ${fullName(lesson.updatedBy)}`}
            {dirty && <span className="ml-2 font-medium text-tesla-rouge">· non enregistrée</span>}
          </p>
        </div>
        {editable && (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Monter la leçon ${index + 1}`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Descendre la leçon ${index + 1}`}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          disabled={open && dirty}
          title={open && dirty ? 'Enregistrez ou annulez vos modifications' : undefined}
          onClick={onToggle}
        >
          {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          {open ? 'Fermer' : editable ? 'Modifier' : 'Lire'}
        </Button>
      </header>

      {open && (
        <div id={`${id}-body`} className="space-y-3 border-t p-3">
          {conflict && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <p>
                Cette leçon a été modifiée par une autre personne pendant votre saisie. Vos
                modifications n’ont pas été enregistrées.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                Charger la version enregistrée (vos modifications seront perdues)
              </Button>
            </div>
          )}
          {editable ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <div className="space-y-1">
                  <Label htmlFor={`${id}-title`}>Titre de la leçon</Label>
                  <Input
                    id={`${id}-title`}
                    maxLength={150}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      markDirty();
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-duration`}>Durée (minutes)</Label>
                  <Input
                    id={`${id}-duration`}
                    inputMode="numeric"
                    value={duration}
                    onChange={(event) => {
                      setDuration(event.target.value);
                      markDirty();
                    }}
                  />
                </div>
              </div>
              <LessonEditor
                key={editorKey}
                value={lesson.content}
                label={`Contenu de la leçon ${lesson.title}`}
                onChange={(document) => {
                  setContent(document);
                  markDirty();
                }}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty || saving || conflict}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer la leçon'}
                </Button>
                <Button type="button" variant="outline" onClick={reset} disabled={!dirty || saving}>
                  Annuler les modifications
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className="text-destructive sm:ml-auto">
                      <Trash2 aria-hidden />
                      Supprimer
                    </Button>
                  }
                  title="Supprimer cette leçon ?"
                  description={
                    <p>
                      La leçon « {lesson.title} » et ses ressources seront retirées de ce brouillon.
                      Les versions déjà publiées ne sont pas touchées.
                    </p>
                  }
                  confirmLabel="Supprimer"
                  destructive
                  onConfirm={remove}
                />
              </div>
            </>
          ) : (
            <LessonContent document={lesson.content} />
          )}
        </div>
      )}
    </article>
  );
}
