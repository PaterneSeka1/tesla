'use client';

import { useQuery } from '@tanstack/react-query';
import { type EditorModuleDetail, MAX_TEXT_LINKS } from '@tesla/shared';
import { Link2, Unlink } from 'lucide-react';
import { useId, useState } from 'react';
import { useModuleAction } from '@/components/modules/use-module-action';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { setTextLinks, textCandidatesQueryOptions } from '@/lib/api/modules';

/**
 * Textes fondamentaux cités par le brouillon (prière, charte…) : un lien vers le texte, jamais une
 * copie. La bibliothèque n'affiche un texte cité qu'une fois publié.
 */
export function TextsPanel({
  module,
  editable,
}: {
  module: EditorModuleDetail;
  editable: boolean;
}) {
  const run = useModuleAction();
  const id = useId();
  const { current } = module;
  const candidates = useQuery({ ...textCandidatesQueryOptions, enabled: editable });
  const [textId, setTextId] = useState('');
  const linked = current.textLinks.map((text) => text.moduleId);
  const available =
    candidates.data?.items.filter(
      (text) => text.moduleId !== module.id && !linked.includes(text.moduleId),
    ) ?? [];

  const save = (textModuleIds: string[], success: string) =>
    run(() => setTextLinks(module.id, { versionId: current.id, textModuleIds }), {
      success,
      error: 'Enregistrement impossible',
    });

  return (
    <div className="space-y-4">
      {current.textLinks.length > 0 ? (
        <ul className="space-y-2">
          {current.textLinks.map((text) => (
            <li
              key={text.moduleId}
              className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm"
            >
              <span className="flex-1">
                <span className="font-medium">{text.title}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {text.code}
                  {!text.published && ' · non publié (invisible des routiers)'}
                </span>
              </span>
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void save(
                      linked.filter((moduleId) => moduleId !== text.moduleId),
                      'Texte retiré',
                    )
                  }
                >
                  <Unlink aria-hidden />
                  Retirer
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun texte cité.</p>
      )}
      {editable && linked.length < MAX_TEXT_LINKS && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${id}-text`}>Citer un texte fondamental</Label>
            <NativeSelect
              id={`${id}-text`}
              value={textId}
              onChange={(event) => setTextId(event.target.value)}
            >
              <option value="">
                {available.length ? 'Choisir un texte' : 'Aucun texte disponible'}
              </option>
              {available.map((text) => (
                <option key={text.moduleId} value={text.moduleId}>
                  {text.title}
                  {text.published ? '' : ' (non publié)'}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            disabled={!textId}
            onClick={async () => {
              if (await save([...linked, textId], 'Texte cité')) setTextId('');
            }}
          >
            <Link2 aria-hidden />
            Citer
          </Button>
        </div>
      )}
    </div>
  );
}
