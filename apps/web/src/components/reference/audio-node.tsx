'use client';

import { isAudioSynchronized, type LessonAudioAttrs, lessonFileImageSrc } from '@tesla/shared';
import {
  type Editor,
  mergeAttributes,
  Node,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { AudioLines, Loader2, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AUDIO_ACCEPT, uploadAudioFile } from './audio-upload';
import { SyncWorkshop } from './sync-workshop';

const ATTRIBUTE_NAMES = [
  'src',
  'title',
  'credit',
  'rights',
  'download',
  'segments',
  'syncedSrc',
] as const;

const DEFAULTS: Omit<LessonAudioAttrs, 'src'> & { src: string | null } = {
  src: null,
  title: null,
  credit: null,
  rights: 'INCONNUS',
  download: false,
  segments: [],
  syncedSrc: null,
};

/**
 * Nœud Tiptap « Enregistrement » (D221) : bloc atomique `{ type: 'audio', attrs }`, attributs
 * revalidés par l'API (liste blanche, fichier vérifié du module, chronologie cohérente) à chaque
 * enregistrement de la leçon. Paroles et repères se règlent dans l'atelier.
 */
export const AudioNode = Node.create<{ moduleId?: string }>({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { moduleId: undefined };
  },

  addAttributes() {
    return Object.fromEntries(
      ATTRIBUTE_NAMES.map((name) => [
        name,
        {
          default: DEFAULTS[name],
          parseHTML: (element: HTMLElement) => {
            try {
              const all = JSON.parse(element.getAttribute('data-audio') ?? '{}') as Record<
                string,
                unknown
              >;
              return all[name] ?? DEFAULTS[name];
            } catch {
              return DEFAULTS[name];
            }
          },
          // Un seul attribut HTML porte l'ensemble (copier-coller dans l'éditeur).
          renderHTML: () => ({}),
        },
      ]),
    );
  },

  parseHTML() {
    return [{ tag: 'div[data-audio]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-audio': JSON.stringify(node.attrs) })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeView);
  },
});

function AudioNodeView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  extension,
}: ReactNodeViewProps) {
  const attrs = node.attrs as LessonAudioAttrs;
  const [open, setOpen] = useState(false);
  const moduleId = (extension.options as { moduleId?: string }).moduleId;
  const synced = isAudioSynchronized(attrs);
  const marked = attrs.segments.some((segment) => segment.startMs !== null);
  const status = synced
    ? `${attrs.segments.length} phrase(s) synchronisée(s)`
    : attrs.segments.length === 0
      ? 'Sans paroles'
      : marked
        ? 'Synchronisation à valider'
        : 'Paroles non synchronisées';
  return (
    <NodeViewWrapper
      className="my-3 flex flex-wrap items-center gap-3 rounded-xl border-2 border-tesla-or/50 bg-tesla-sable/20 p-3"
      contentEditable={false}
      data-drag-handle
    >
      <AudioLines className="size-5 shrink-0 text-tesla-bordeaux" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-tesla-bordeaux">
          {attrs.title || 'Enregistrement'}
        </span>
        <span className="block text-xs text-muted-foreground">
          {status}
          {attrs.rights !== 'AUTORISES' && ' · droits à confirmer'}
        </span>
      </span>
      {editor.isEditable && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Settings2 aria-hidden />
            Atelier
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={deleteNode}
            aria-label="Supprimer l’enregistrement de la leçon"
          >
            <Trash2 aria-hidden />
          </Button>
          {open && (
            <SyncWorkshop
              initial={attrs}
              moduleId={moduleId}
              open={open}
              onOpenChange={setOpen}
              onSave={(next) => updateAttributes(next)}
            />
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Champ de fichier caché : envoie l'enregistrement choisi puis insère le bloc à la position du
 * curseur (droits « non vérifiés » par défaut, téléchargement non autorisé).
 */
export function AudioFileInput({
  editor,
  moduleId,
  ref,
  onStatus,
}: {
  editor: Editor;
  moduleId: string;
  ref: React.Ref<HTMLInputElement>;
  onStatus: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={AUDIO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const stored = await uploadAudioFile(moduleId, file, (message) => onStatus(message));
            const attrs: LessonAudioAttrs = {
              ...DEFAULTS,
              src: lessonFileImageSrc(stored.id),
              title: file.name.replace(/\.[^.]+$/, '').slice(0, 200),
            };
            editor.chain().focus().insertContent({ type: 'audio', attrs }).run();
            onStatus('Enregistrement ajouté : ouvrez l’atelier pour les paroles et les droits.');
          } catch (error) {
            onStatus(error instanceof Error ? error.message : 'Envoi impossible.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Envoi en cours"
        />
      )}
    </>
  );
}
