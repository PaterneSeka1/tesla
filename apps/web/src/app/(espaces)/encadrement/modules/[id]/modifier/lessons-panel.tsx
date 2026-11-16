'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type EditorModuleDetail, type ModuleLesson } from '@tesla/shared';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CircleAlert,
  CloudOff,
  ListOrdered,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { LessonContent } from '@/components/modules/lesson-content';
import { LessonEditor } from '@/components/modules/lesson-editor';
import { type AutosaveStatus, useLessonAutosave } from '@/components/modules/use-lesson-autosave';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addLesson, createModuleVersion, deleteLesson, reorderLessons } from '@/lib/api/modules';
import { formatDateTime, formatDuration, fullName } from '@/lib/format';
import { readLessonDraft } from '@/lib/lesson-drafts';
import { cn } from '@/lib/utils';

/** Champ « Nouvelle leçon » visible (le panneau des leçons existe en version mobile et ordinateur). */
function focusNewLessonInput() {
  requestAnimationFrame(() => {
    const input = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-new-lesson]'),
    ).find((element) => element.offsetParent !== null);
    input?.scrollIntoView({ block: 'center' });
    input?.focus();
  });
}

/**
 * Espace de rédaction des leçons (refonte lot 1) : navigation ordonnée des leçons et zone de
 * rédaction. Chaque leçon s'enregistre automatiquement ; la leçon ouverte est dans l'adresse
 * (`?lecon=`), ce qui permet d'y revenir depuis la vérification. `?ajout=1` ouvre directement le
 * champ « Nouvelle leçon » (D182) : le module parent est celui de la page, jamais redemandé.
 */
export function LessonsPanel({
  module,
  editable,
}: {
  module: EditorModuleDetail;
  editable: boolean;
}) {
  const run = useModuleAction();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lessons = module.current.lessons;
  const requested = params.get('lecon');
  const selected = lessons.find((lesson) => lesson.id === requested) ?? lessons[0] ?? null;
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const addRequested = editable && params.get('ajout') === '1';
  const [navOpen, setNavOpen] = useState(addRequested);
  const [newTitle, setNewTitle] = useState('');
  const newTitleId = useId();
  const navId = useId();

  const select = useCallback(
    (lessonId: string) => {
      const next = new URLSearchParams(params.toString());
      next.set('lecon', lessonId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setNavOpen(false);
    },
    [params, pathname, router],
  );

  // Ajout demandé depuis la liste des modules ou un module en ligne : focus sur le titre, puis
  // l'adresse est nettoyée (un rechargement ne rouvre pas le champ).
  useEffect(() => {
    if (!addRequested) return;
    focusNewLessonInput();
    const next = new URLSearchParams(params.toString());
    next.delete('ajout');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [addRequested, params, pathname, router]);

  // Focus après l'affichage du panneau (rendu terminé), quel que soit le moteur du navigateur.
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) focusNewLessonInput();
  }, [focusRequest]);
  const openAdd = () => {
    setNavOpen(true);
    setFocusRequest((count) => count + 1);
  };

  // Module en ligne : l'ajout ouvre une version de travail (copie de la version publiée, qui reste
  // visible des routiers jusqu'à la publication de la suivante), puis le champ « Nouvelle leçon ».
  const startVersionAndAdd = async () => {
    // L'intention d'ajout est posée dans l'adresse avant la création : le panneau, remonté sur la
    // nouvelle version (clé), s'ouvre alors directement sur le champ « Nouvelle leçon ».
    const before = params.toString();
    const next = new URLSearchParams(before);
    next.set('section', 'contenu');
    next.set('ajout', '1');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    const ok = await run(() => createModuleVersion(module.id), {
      success: 'Version de travail ouverte',
      error: 'Ouverture impossible',
      detail: module.publishedVersionId
        ? 'La version en ligne reste visible des routiers jusqu’à la publication de celle-ci.'
        : undefined,
    });
    if (!ok) router.replace(`${pathname}?${before}`, { scroll: false });
  };

  // Avertit avant de quitter la page si une saisie n'est pas confirmée par le serveur.
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

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
    pendingSelectLast.current = lessons.length;
    const ok = await run(() => addLesson(module.id, { versionId: module.current.id, title }), {
      success: 'Leçon ajoutée',
      error: 'Ajout impossible',
    });
    if (ok) setNewTitle('');
    else pendingSelectLast.current = null;
  };
  // Après un ajout, la nouvelle leçon (dernière position) est ouverte dès qu'elle est chargée.
  const pendingSelectLast = useRef<number | null>(null);
  useEffect(() => {
    const previousCount = pendingSelectLast.current;
    if (previousCount === null || lessons.length <= previousCount) return;
    pendingSelectLast.current = null;
    select(lessons[lessons.length - 1]!.id);
  }, [lessons, select]);

  const addForm = editable && (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={newTitleId}>Nouvelle leçon</Label>
      <Input
        id={newTitleId}
        data-new-lesson
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
      <Button
        type="button"
        className="w-full"
        onClick={() => void create()}
        disabled={!newTitle.trim()}
      >
        <Plus aria-hidden />
        Ajouter la leçon
      </Button>
    </div>
  );

  const versionNotice = !editable && module.permissions.canCreateVersion && (
    <div className="flex flex-col gap-3 rounded-lg border border-tesla-or/50 bg-tesla-sable/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm sm:flex-1">
        {module.publishedVersionId
          ? 'Les routiers gardent la version en ligne jusqu’à la publication de la nouvelle.'
          : 'Une version de travail est ouverte pour ajouter la leçon.'}
      </p>
      <Button type="button" className="sm:shrink-0" onClick={() => void startVersionAndAdd()}>
        <Plus aria-hidden />
        Ajouter une leçon
      </Button>
    </div>
  );

  if (lessons.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={BookOpen}
          title="Aucune leçon"
          description={
            editable
              ? 'Ajoutez une première leçon : elle s’enregistre automatiquement pendant la rédaction.'
              : undefined
          }
        />
        {editable && <div className="mx-auto max-w-md">{addForm}</div>}
        {versionNotice}
      </div>
    );
  }

  const selectedIndex = selected ? lessons.indexOf(selected) : -1;
  const nav = (
    <nav aria-label="Leçons du module" className="space-y-3">
      <ol className="space-y-1">
        {lessons.map((lesson, index) => {
          const current = lesson.id === selected?.id;
          const pending = current ? status !== 'saved' : readLessonDraft(lesson.id) !== null;
          return (
            <li key={lesson.id} className="group flex items-center gap-1">
              <button
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => select(lesson.id)}
                onKeyDown={(event) => {
                  if (!editable || !event.altKey) return;
                  if (event.key === 'ArrowUp' && index > 0) {
                    event.preventDefault();
                    move(index, -1);
                  }
                  if (event.key === 'ArrowDown' && index < lessons.length - 1) {
                    event.preventDefault();
                    move(index, 1);
                  }
                }}
                className={cn(
                  'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  current && 'bg-tesla-sable/60 font-medium text-tesla-bordeaux',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-tesla-bordeaux ring-1 ring-tesla-or/50">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                {pending && (
                  <span
                    className="size-2 shrink-0 rounded-full bg-tesla-rouge"
                    title="Modification non encore confirmée par le serveur"
                  >
                    <span className="sr-only"> — modification non synchronisée</span>
                  </span>
                )}
              </button>
              {editable && (
                <span className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Monter la leçon ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Descendre la leçon ${index + 1}`}
                    disabled={index === lessons.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {editable && (
        <p className="text-xs text-muted-foreground">
          Astuce : Alt + flèche haut/bas déplace la leçon sélectionnée.
        </p>
      )}
      {addForm}
    </nav>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {versionNotice && <div className="lg:col-span-2">{versionNotice}</div>}
      {/* Petit écran : la liste des leçons est un panneau repliable au-dessus de la rédaction ;
          « Ajouter une leçon » reste visible sans l'ouvrir. */}
      <div className="lg:hidden">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-between"
            aria-expanded={navOpen}
            aria-controls={navId}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ListOrdered aria-hidden />
              <span className="truncate">
                Leçon {selectedIndex + 1} sur {lessons.length} · {selected?.title}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">{navOpen ? 'Fermer' : 'Changer'}</span>
          </Button>
          {editable && (
            <Button
              type="button"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Ajouter une leçon"
              onClick={openAdd}
            >
              <Plus aria-hidden />
            </Button>
          )}
        </div>
        {navOpen && (
          <div id={navId} className="mt-2 rounded-lg border bg-card p-3">
            {nav}
          </div>
        )}
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border bg-card p-3">
          {nav}
        </div>
      </aside>
      {selected && (
        <LessonPane
          key={selected.id}
          moduleId={module.id}
          lesson={selected}
          index={selectedIndex}
          editable={editable}
          onStatus={setStatus}
          onDeleted={() => {
            const neighbour = lessons[selectedIndex + 1] ?? lessons[selectedIndex - 1];
            if (neighbour) select(neighbour.id);
          }}
        />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<AutosaveStatus, string> = {
  saved: 'Enregistré',
  dirty: 'Modifications en cours…',
  saving: 'Enregistrement…',
  offline: 'Hors connexion — conservé sur cet appareil, envoi au retour du réseau',
  error: 'Échec de l’enregistrement — conservé sur cet appareil',
  invalid: 'À corriger avant enregistrement',
  conflict: 'Conflit : la leçon a été modifiée par une autre personne',
};

function SaveIndicator({ status, savedAt }: { status: AutosaveStatus; savedAt: number | null }) {
  const Icon =
    status === 'saved'
      ? Check
      : status === 'saving' || status === 'dirty'
        ? Loader2
        : status === 'offline'
          ? CloudOff
          : CircleAlert;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-sm',
        status === 'saved' && 'text-emerald-700',
        (status === 'saving' || status === 'dirty') && 'text-muted-foreground',
        (status === 'offline' || status === 'error' || status === 'invalid') && 'text-amber-800',
        status === 'conflict' && 'text-destructive',
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-4 shrink-0', status === 'saving' && 'motion-safe:animate-spin')}
      />
      <span>
        {STATUS_LABELS[status]}
        {status === 'saved' && savedAt
          ? ` à ${new Date(savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : ''}
      </span>
    </p>
  );
}

function LessonPane({
  moduleId,
  lesson,
  index,
  editable,
  onStatus,
  onDeleted,
}: {
  moduleId: string;
  lesson: ModuleLesson;
  index: number;
  editable: boolean;
  onStatus: (status: AutosaveStatus) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const run = useModuleAction();
  const id = useId();
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['modules'] }),
    [queryClient],
  );
  const autosave = useLessonAutosave(lesson, {
    editable,
    onSaved: refresh,
    onConflict: refresh,
  });
  const { status, values } = autosave;

  useEffect(() => onStatus(status), [status, onStatus]);
  useEffect(() => () => onStatus('saved'), [onStatus]);

  const remove = async () => {
    const ok = await run(() => deleteLesson(lesson.id, lesson.revision), {
      success: 'Leçon supprimée',
      error: 'Suppression impossible',
    });
    if (ok) onDeleted();
    return ok;
  };

  if (!editable) {
    return (
      <article className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
        <header>
          <p className="text-sm text-muted-foreground">Leçon {index + 1}</p>
          <h3 className="text-xl font-semibold text-tesla-bordeaux">{lesson.title}</h3>
          {lesson.durationMinutes ? (
            <p className="text-sm text-muted-foreground">
              {formatDuration(lesson.durationMinutes)}
            </p>
          ) : null}
        </header>
        <LessonContent document={lesson.content} />
      </article>
    );
  }

  return (
    <article className="min-w-0 space-y-3" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className="sr-only">
        Leçon {index + 1} : {values.title || lesson.title}
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SaveIndicator status={status} savedAt={autosave.savedAt} />
        <div className="flex flex-wrap gap-2">
          {(status === 'offline' || status === 'error') && (
            <Button type="button" size="sm" variant="outline" onClick={autosave.saveNow}>
              Réessayer maintenant
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm" variant="ghost" className="text-destructive">
                <Trash2 aria-hidden />
                Supprimer la leçon
              </Button>
            }
            title="Supprimer cette leçon ?"
            description={
              <p>
                La leçon « {lesson.title} » et ses ressources seront retirées de ce brouillon. Les
                versions déjà publiées ne sont pas touchées.
              </p>
            }
            confirmLabel="Supprimer"
            destructive
            onConfirm={remove}
          />
        </div>
      </div>

      {autosave.restored && status !== 'conflict' && (
        <p
          role="status"
          className="rounded-md border border-tesla-or/50 bg-tesla-sable/40 px-3 py-2 text-sm"
        >
          Modifications non envoyées retrouvées sur cet appareil : elles sont reprises et
          enregistrées.
        </p>
      )}
      {status === 'conflict' && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p>
            Cette leçon a été modifiée par une autre personne (ou sur un autre appareil) pendant
            votre saisie. Votre version est conservée sur cet appareil ; rien n’a été remplacé.
          </p>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm">
                  Garder ma version
                </Button>
              }
              title="Remplacer la version enregistrée ?"
              description={
                <p>
                  La version enregistrée par l’autre personne sera remplacée par la vôtre. Consultez
                  l’aperçu avant de confirmer si vous avez un doute.
                </p>
              }
              confirmLabel="Garder ma version"
              onConfirm={async () => {
                autosave.keepMine();
                return true;
              }}
            />
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm" variant="outline">
                  Reprendre la version enregistrée
                </Button>
              }
              title="Abandonner votre saisie ?"
              description={<p>Vos modifications non enregistrées seront perdues.</p>}
              confirmLabel="Abandonner ma saisie"
              destructive
              onConfirm={async () => {
                autosave.takeServer();
                return true;
              }}
            />
          </div>
        </div>
      )}
      {autosave.message && status !== 'conflict' && (
        <p role="alert" className="text-sm text-destructive">
          {autosave.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-title`}>Titre de la leçon {index + 1}</Label>
          <Input
            id={`${id}-title`}
            maxLength={150}
            className="text-base font-medium"
            value={values.title}
            onChange={(event) => autosave.change({ title: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-duration`}>Durée (minutes)</Label>
          <Input
            id={`${id}-duration`}
            inputMode="numeric"
            value={values.duration}
            onChange={(event) => autosave.change({ duration: event.target.value })}
          />
        </div>
      </div>
      <LessonEditor
        key={autosave.editorKey}
        value={values.content as ModuleLesson['content']}
        moduleId={moduleId}
        className="min-h-[50vh]"
        label={`Contenu de la leçon ${values.title || lesson.title}`}
        onChange={(document) => autosave.change({ content: document })}
      />
      <p className="text-xs text-muted-foreground">
        Modifiée le {formatDateTime(lesson.updatedAt)}
        {lesson.updatedBy && ` par ${fullName(lesson.updatedBy)}`}. Enregistrement automatique après
        une courte pause dans la saisie.
      </p>
    </article>
  );
}
