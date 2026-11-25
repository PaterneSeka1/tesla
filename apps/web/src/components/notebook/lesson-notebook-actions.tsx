'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NOTE_MAX_LENGTH } from '@tesla/shared';
import { Bookmark, BookmarkCheck, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { notebookQueryOptions, saveNote, setBookmark } from '@/lib/api/notebook';
import { userCan } from '@/lib/navigation';
import { OfflineQueuedError } from '@/lib/offline/operations';

/**
 * Favori et note personnelle d'une leçon (D209) : deux icônes discrètes dans l'en-tête du lecteur.
 * La note est privée (titulaire seul) ; hors ligne, elle est gardée sur l'appareil et envoyée
 * ensuite ; une modification faite entre-temps sur un autre appareil est signalée, jamais écrasée.
 */
export function LessonNotebookActions({
  moduleSlug,
  lessonId,
}: {
  moduleSlug: string;
  lessonId: string;
}) {
  const user = useSessionUser();
  const owns = userCan(user, 'practice.own');
  const queryClient = useQueryClient();
  const notebook = useQuery({ ...notebookQueryOptions, enabled: owns });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!owns) return null;

  const bookmarked = !!notebook.data?.bookmarks.some(
    (item) => item.kind === 'lesson' && item.lessonId === lessonId,
  );
  const note = notebook.data?.notes.find((item) => item.lessonId === lessonId) ?? null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: notebookQueryOptions.queryKey });

  const toggle = async () => {
    try {
      queryClient.setQueryData(
        notebookQueryOptions.queryKey,
        await setBookmark({ moduleSlug, lessonId, on: !bookmarked }),
      );
    } catch (error) {
      if (!(error instanceof OfflineQueuedError)) return;
    }
    void refresh();
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveNote({ moduleSlug, lessonId, body: draft, revision: note?.revision ?? 0 });
      await refresh();
      setOpen(false);
    } catch (error) {
      if (error instanceof OfflineQueuedError) {
        setMessage('Enregistrée sur cet appareil, envoyée à la prochaine connexion.');
      } else if (error instanceof ApiError && error.status === 409) {
        setMessage(
          'Cette note a été modifiée sur un autre appareil. Rechargée : vérifiez avant d’enregistrer.',
        );
        const fresh = await notebook.refetch();
        setDraft(fresh.data?.notes.find((item) => item.lessonId === lessonId)?.body ?? '');
      } else setMessage('Enregistrement impossible pour l’instant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void toggle()}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        disabled={notebook.isPending}
      >
        {bookmarked ? (
          <BookmarkCheck className="text-tesla-rouge" aria-hidden />
        ) : (
          <Bookmark aria-hidden />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={note ? 'Ma note (modifier)' : 'Prendre une note'}
        onClick={() => {
          setDraft(note?.body ?? '');
          setMessage(null);
          setOpen(true);
        }}
        disabled={notebook.isPending}
      >
        <NotebookPen className={note ? 'text-tesla-rouge' : undefined} aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ma note</DialogTitle>
            <DialogDescription>Visible par vous seul.</DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Ma note sur cette leçon"
            className="min-h-40 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={draft}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
          />
          {message && (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => void save()} disabled={saving || (!note && !draft.trim())}>
              {note && !draft.trim() ? 'Supprimer la note' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
