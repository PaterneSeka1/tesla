'use client';

import {
  type PracticeActivity,
  practiceActivitySchema,
  PRACTICE_KIND_LABELS,
  practiceItemCount,
} from '@tesla/shared';
import {
  mergeAttributes,
  Node,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { Pencil, Puzzle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PracticeFormDialog } from './practice-form';

/**
 * Nœud Tiptap « Activité d'entraînement » (D194) : bloc atomique dont les attributs sont
 * l'activité validée par `practiceActivitySchema`. Dans le document JSON : `{ type: 'practice',
 * attrs: { activity } }`, revalidé par l'API à chaque enregistrement.
 */
export const PracticeNode = Node.create({
  name: 'practice',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      activity: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          try {
            const parsed = practiceActivitySchema.safeParse(
              JSON.parse(element.getAttribute('data-practice') ?? 'null'),
            );
            return parsed.success ? parsed.data : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: { activity: PracticeActivity | null }) => ({
          'data-practice': JSON.stringify(attributes.activity),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-practice]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PracticeNodeView);
  },
});

function PracticeNodeView({ node, updateAttributes, deleteNode, editor }: ReactNodeViewProps) {
  const activity = node.attrs.activity as PracticeActivity | null;
  const [open, setOpen] = useState(false);
  if (!activity)
    return (
      <NodeViewWrapper className="my-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        Activité illisible.
      </NodeViewWrapper>
    );
  const count = practiceItemCount(activity);
  return (
    <NodeViewWrapper
      className="my-3 flex items-center gap-3 rounded-xl border-2 border-tesla-or/50 bg-tesla-sable/20 p-3"
      contentEditable={false}
      data-drag-handle
    >
      <Puzzle className="size-5 shrink-0 text-tesla-bordeaux" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-tesla-bordeaux">
          {activity.title || PRACTICE_KIND_LABELS[activity.kind]}
        </span>
        <span className="block text-xs text-muted-foreground">
          Activité · {PRACTICE_KIND_LABELS[activity.kind]}
          {count > 0 && ` · ${count}`}
        </span>
      </span>
      {editor.isEditable && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Pencil aria-hidden />
            Modifier
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={deleteNode}
            aria-label="Supprimer l’activité"
          >
            <Trash2 aria-hidden />
          </Button>
          {open && (
            <PracticeFormDialog
              initial={activity}
              open={open}
              onOpenChange={setOpen}
              onSave={(next) => updateAttributes({ activity: next })}
            />
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}
