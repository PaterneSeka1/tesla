'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, NotebookPen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { notebookQueryOptions, removeNotebookItem } from '@/lib/api/notebook';
import { formatDate } from '@/lib/format';

const href = (item: { moduleSlug: string; lessonId: string | null }) =>
  item.lessonId
    ? `/modules/${item.moduleSlug}/lecons/${item.lessonId}`
    : `/modules/${item.moduleSlug}`;

/**
 * Favoris et notes dans le carnet (D209) : repliés par défaut, détail à la demande. Un contenu
 * retiré reste listé (« plus disponible ») et peut être supprimé par son titulaire.
 */
export function NotebookSections() {
  const queryClient = useQueryClient();
  const { data } = useQuery(notebookQueryOptions);
  if (!data || (data.bookmarks.length === 0 && data.notes.length === 0)) return null;
  const remove = async (kind: 'bookmarks' | 'notes', id: string) => {
    try {
      queryClient.setQueryData(notebookQueryOptions.queryKey, await removeNotebookItem(kind, id));
    } catch {
      // Hors connexion : la suppression se fera au retour du réseau (nouvel essai manuel).
    }
  };

  return (
    <div className="space-y-2">
      {data.bookmarks.length > 0 && (
        <details className="rounded-xl border bg-card px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <Bookmark className="size-4 text-tesla-rouge" aria-hidden />
            Favoris · {data.bookmarks.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {data.bookmarks.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                {item.available ? (
                  <Link
                    href={href(item)}
                    className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                  >
                    {item.lessonTitle ?? item.moduleTitle}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {item.lessonTitle ?? item.moduleTitle} · plus disponible
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Retirer des favoris"
                  onClick={() => void remove('bookmarks', item.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {data.notes.length > 0 && (
        <details className="rounded-xl border bg-card px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <NotebookPen className="size-4 text-tesla-rouge" aria-hidden />
            Mes notes · {data.notes.length}
          </summary>
          <ul className="mt-2 space-y-3">
            {data.notes.map((note) => (
              <li key={note.id} className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {note.available ? (
                    <Link
                      href={href(note)}
                      className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
                    >
                      {note.lessonTitle}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {note.moduleTitle} · leçon plus disponible
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(note.updatedAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Supprimer la note"
                    onClick={() => void remove('notes', note.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
