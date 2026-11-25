'use client';

import { buildPracticeBank, lessonDocumentSchema, PRACTICE_KIND_LABELS } from '@tesla/shared';
import { type Editor, Extension, useEditorState } from '@tiptap/react';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityRunner } from '@/components/practice/activity-runner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Attribut `noPractice` (D208) sur les blocs dont l'application tire des exercices : liste
 * numérotée (remise en ordre), citation (texte à compléter), titre « À retenir » (carte). Le texte
 * reste intact ; seule la décision « ne pas en tirer d'exercice » est enregistrée dans la leçon.
 */
export const NoPracticeAttribute = Extension.create({
  name: 'noPractice',
  addGlobalAttributes() {
    return [
      {
        types: ['orderedList', 'blockquote', 'heading'],
        attributes: {
          noPractice: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute('data-no-practice') === 'true' ? true : null,
            renderHTML: (attributes) =>
              attributes.noPractice ? { 'data-no-practice': 'true' } : {},
          },
        },
      },
    ];
  },
});

/**
 * Exercices tirés du texte de la leçon en cours de rédaction : aperçu dans le rendu apprenant
 * (rien n'est enregistré) et choix de les proposer ou non. Une liste numérotée n'est pas toujours
 * une séquence : l'encadrement décide.
 */
export function DerivedPracticePanel({ editor }: { editor: Editor }) {
  const json = useEditorState({ editor, selector: ({ editor: e }) => e.getJSON() });
  const derived = useMemo(() => {
    // Document normalisé par la liste blanche (comme à l'enregistrement) ; brouillon invalide :
    // rien à proposer tant qu'il n'est pas corrigé.
    const parsed = lessonDocumentSchema.safeParse(json);
    if (!parsed.success) return [];
    return buildPracticeBank([{ id: 'apercu', title: 'Leçon', content: parsed.data }], {
      includeDisabled: true,
    }).filter((entry) => entry.origin === 'derived');
  }, [json]);
  const [preview, setPreview] = useState<(typeof derived)[number] | null>(null);
  if (derived.length === 0) return null;

  const toggle = (index: number, off: boolean) =>
    editor
      .chain()
      .command(({ tr }) => {
        let position = -1;
        tr.doc.forEach((_, offset, child) => {
          if (child === index) position = offset;
        });
        const node = position >= 0 ? tr.doc.nodeAt(position) : null;
        if (!node) return false;
        tr.setNodeMarkup(position, undefined, { ...node.attrs, noPractice: off ? true : null });
        return true;
      })
      .run();

  return (
    <details className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">
        Exercices tirés du texte ({derived.filter((entry) => !entry.disabled).length}/
        {derived.length})
      </summary>
      <ul className="mt-2 space-y-1.5">
        {derived.map((entry) => (
          <li key={entry.key} className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-tesla-rouge"
                checked={!entry.disabled}
                onChange={(event) => toggle(entry.source ?? -1, !event.target.checked)}
              />
              <span
                className={cn(
                  'min-w-0 truncate',
                  entry.disabled && 'text-muted-foreground line-through',
                )}
              >
                {PRACTICE_KIND_LABELS[entry.activity.kind]} · {entry.activity.title}
              </span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(entry)}>
              <Eye aria-hidden />
              Aperçu
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview && PRACTICE_KIND_LABELS[preview.activity.kind]}</DialogTitle>
            <DialogDescription>Aperçu : rien n’est enregistré.</DialogDescription>
          </DialogHeader>
          {preview && (
            <ActivityRunner
              item={{ moduleSlug: '', key: preview.key, activity: preview.activity }}
              compact
            />
          )}
        </DialogContent>
      </Dialog>
    </details>
  );
}
