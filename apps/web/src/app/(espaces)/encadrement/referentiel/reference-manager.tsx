'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ManagedReferenceCategory,
  REFERENCE_AMBIANCE_LABELS,
  REFERENCE_AMBIANCES,
  REFERENCE_ICONS,
  type ReferenceAmbiance,
  type ReferenceIcon,
} from '@tesla/shared';
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { ReferenceIconView } from '@/components/reference/reference-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useToast } from '@/components/ui/toaster';
import {
  allEditorModulesQueryOptions,
  createModule,
  editorModuleQueryOptions,
} from '@/lib/api/modules';
import {
  addReferenceEntry,
  createReferenceCategory,
  managedReferenceQueryOptions,
  removeReferenceEntry,
  reorderReferenceCategories,
  reorderReferenceEntries,
  updateReferenceCategory,
} from '@/lib/api/reference';

const STATE_LABELS = {
  PUBLIEE: 'Publiée',
  NON_PUBLIEE: 'Non publiée',
  LECON_ABSENTE: 'Leçon absente de la version publiée',
} as const;

function move<T>(list: readonly T[], index: number, delta: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item!);
  return next;
}

/**
 * Gestion du référentiel scout (D220) : rubriques (responsable plein) et rangement des modules
 * (rédacteurs). Le contenu se rédige et se publie dans l'éditeur de modules, par le circuit
 * habituel : une ressource n'apparaît aux routiers qu'une fois publiée.
 */
export function ReferenceManager() {
  const { data, error, isPending, refetch } = useQuery(managedReferenceQueryOptions);
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reference'] });
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => void refresh(),
    onError: (err: Error) => toast.error('Action impossible', err.message),
  });

  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <TableSkeleton rows={6} />;
  const active = data.categories.filter((category) => !category.archived);
  const archived = data.categories.filter((category) => category.archived);

  return (
    <>
      <PageHeading title="Rubriques du référentiel" />
      <Guide />
      {data.canManageCategories && (
        <NewCategory onCreate={(input) => run.mutate(() => createReferenceCategory(input))} />
      )}
      <div className="space-y-4">
        {active.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            canManage={data.canManageCategories}
            busy={run.isPending}
            onMove={(delta) =>
              run.mutate(() =>
                reorderReferenceCategories({
                  ids: move(active, index, delta)
                    .concat(archived)
                    .map((item) => item.id),
                }),
              )
            }
            isFirst={index === 0}
            isLast={index === active.length - 1}
            run={(action) => run.mutate(action)}
          />
        ))}
      </div>
      {archived.length > 0 && (
        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Rubriques retirées ({archived.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {archived.map((category) => (
              <li key={category.id} className="flex items-center gap-2">
                <span className="flex-1">{category.title}</span>
                {data.canManageCategories && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      run.mutate(() => updateReferenceCategory(category.id, { archived: false }))
                    }
                  >
                    <ArchiveRestore aria-hidden />
                    Rétablir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Guide() {
  return (
    <details className="rounded-lg border bg-tesla-sable/20 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-tesla-bordeaux">
        Ajouter un chant, une prière ou un texte officiel
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          Dans la rubrique voulue, choisissez « Nouvelle ressource » : un module « texte fondamental
          » est créé et rangé, puis l’éditeur s’ouvre.
        </li>
        <li>
          Saisissez le texte. Pour un chant ou un récit narré, ajoutez un « Enregistrement » depuis
          la barre d’outils, collez les paroles et marquez chaque phrase pendant l’écoute.
        </li>
        <li>
          Pour une cérémonie : intervenant en gras suivi de « : » (« <strong>Le CC :</strong> … »),
          indications scéniques en citation, notes en « <strong>NB :</strong> … ».
        </li>
        <li>
          Soumettez le module : il apparaît dans le référentiel dès sa publication par le
          responsable.
        </li>
      </ol>
    </details>
  );
}

function NewCategory({
  onCreate,
}: {
  onCreate: (input: {
    title: string;
    ambiance: ReferenceAmbiance;
    icon: ReferenceIcon | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [ambiance, setAmbiance] = useState<ReferenceAmbiance>('DOCUMENTAIRE');
  const [icon, setIcon] = useState<ReferenceIcon | ''>('');
  if (!open)
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouvelle rubrique
      </Button>
    );
  return (
    <form
      className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-[1fr_14rem_10rem_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ title, ambiance, icon: icon || null });
        setTitle('');
        setOpen(false);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="category-title">Titre</Label>
        <Input
          id="category-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Chants de veillée"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="category-ambiance">Présentation</Label>
        <NativeSelect
          id="category-ambiance"
          value={ambiance}
          onChange={(event) => setAmbiance(event.target.value as ReferenceAmbiance)}
        >
          {REFERENCE_AMBIANCES.map((value) => (
            <option key={value} value={value}>
              {REFERENCE_AMBIANCE_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="category-icon">Icône</Label>
        <NativeSelect
          id="category-icon"
          value={icon}
          onChange={(event) => setIcon(event.target.value as ReferenceIcon | '')}
        >
          <option value="">Par défaut</option>
          {REFERENCE_ICONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Créer</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function CategoryCard({
  category,
  canManage,
  busy,
  onMove,
  isFirst,
  isLast,
  run,
}: {
  category: ManagedReferenceCategory;
  canManage: boolean;
  busy: boolean;
  onMove: (delta: number) => void;
  isFirst: boolean;
  isLast: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  return (
    <section
      className="space-y-3 rounded-xl border bg-white p-4"
      aria-labelledby={`cat-${category.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ReferenceIconView name={category.icon} className="size-5 text-tesla-or" />
        <h2
          id={`cat-${category.id}`}
          className="min-w-0 flex-1 basis-[60%] font-semibold text-tesla-bordeaux sm:basis-auto"
        >
          {category.title}
        </h2>
        <Badge variant={category.visible ? 'default' : 'outline'}>
          {category.visible ? 'Visible des routiers' : 'Masquée (aucune ressource publiée)'}
        </Badge>
        {canManage && (
          <div className="flex">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={busy || isFirst}
              onClick={() => onMove(-1)}
              aria-label={`Monter la rubrique ${category.title}`}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={busy || isLast}
              onClick={() => onMove(1)}
              aria-label={`Descendre la rubrique ${category.title}`}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => updateReferenceCategory(category.id, { archived: true }))}
              aria-label={`Retirer la rubrique ${category.title}`}
            >
              <Archive aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {REFERENCE_AMBIANCE_LABELS[category.ambiance]}
      </p>
      {category.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune ressource rangée.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {category.entries.map((entry, index) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                <Link
                  href={`/encadrement/modules/${entry.moduleId}/modifier`}
                  className="font-medium hover:underline"
                >
                  {entry.title}
                </Link>
                {entry.lessonTitle && (
                  <span className="text-muted-foreground"> — {entry.lessonTitle}</span>
                )}
              </span>
              <Badge variant={entry.state === 'PUBLIEE' ? 'secondary' : 'outline'}>
                {STATE_LABELS[entry.state]}
              </Badge>
              {canManage && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run(() =>
                        reorderReferenceEntries(category.id, {
                          ids: move(category.entries, index, -1).map((item) => item.id),
                        }),
                      )
                    }
                    aria-label={`Monter ${entry.title}`}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy || index === category.entries.length - 1}
                    onClick={() =>
                      run(() =>
                        reorderReferenceEntries(category.id, {
                          ids: move(category.entries, index, 1).map((item) => item.id),
                        }),
                      )
                    }
                    aria-label={`Descendre ${entry.title}`}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </>
              )}
              {entry.canRemove && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => removeReferenceEntry(entry.id))}
                  aria-label={`Retirer ${entry.title} de la rubrique (le module est conservé)`}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <AddEntry categoryId={category.id} run={run} />
    </section>
  );
}

/** Ranger un module existant (ou une seule de ses leçons), ou créer une nouvelle ressource. */
function AddEntry({
  categoryId,
  run,
}: {
  categoryId: string;
  run: (action: () => Promise<unknown>) => void;
}) {
  const [mode, setMode] = useState<'closed' | 'existing' | 'new'>('closed');
  const [moduleId, setModuleId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const router = useRouter();
  const toast = useToast();
  const modules = useQuery({ ...allEditorModulesQueryOptions, enabled: mode === 'existing' });
  const detail = useQuery({ ...editorModuleQueryOptions(moduleId), enabled: !!moduleId });

  if (mode === 'closed')
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setMode('new')}>
          <Plus aria-hidden />
          Nouvelle ressource
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode('existing')}>
          Ranger un module existant
        </Button>
      </div>
    );

  if (mode === 'new')
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const created = await createModule({ title, category: 'TEXTE_FONDAMENTAL' });
            await addReferenceEntry({ categoryId, moduleId: created.id });
            router.push(`/encadrement/modules/${created.id}/modifier`);
          } catch (error) {
            toast.error('Création impossible', error instanceof Error ? error.message : undefined);
          }
        }}
      >
        <div className="min-w-56 flex-1 space-y-1">
          <Label htmlFor={`new-${categoryId}`}>Titre de la ressource</Label>
          <Input
            id={`new-${categoryId}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={3}
          />
        </div>
        <Button type="submit" size="sm">
          Créer et rédiger
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode('closed')}>
          Annuler
        </Button>
      </form>
    );

  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => addReferenceEntry({ categoryId, moduleId, lessonId: lessonId || null }));
        setMode('closed');
        setModuleId('');
        setLessonId('');
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`module-${categoryId}`}>Module</Label>
        <NativeSelect
          id={`module-${categoryId}`}
          value={moduleId}
          onChange={(event) => {
            setModuleId(event.target.value);
            setLessonId('');
          }}
          required
        >
          <option value="">{modules.isPending ? 'Chargement…' : 'Choisir…'}</option>
          {(modules.data ?? []).map((module) => (
            <option key={module.id} value={module.id}>
              {module.latest.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`lesson-${categoryId}`}>Partie (facultatif)</Label>
        <NativeSelect
          id={`lesson-${categoryId}`}
          value={lessonId}
          onChange={(event) => setLessonId(event.target.value)}
          disabled={!detail.data}
        >
          <option value="">Module entier</option>
          {(detail.data?.current.lessons ?? []).map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!moduleId}>
          Ranger
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode('closed')}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
