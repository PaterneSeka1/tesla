'use client';

import { type EditorModuleListItem, MODULE_CATEGORY_LABELS } from '@tesla/shared';
import {
  Archive,
  CheckCheck,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  Globe,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createModuleVersion, duplicateModule } from '@/lib/api/modules';
import { authorName, formatDate, formatDateTime } from '@/lib/format';
import { DeleteDraftDialog } from './delete-draft-dialog';
import { ModuleStatusBadge } from './module-status-badge';
import { useModuleAction } from './use-module-action';

interface ItemsProps {
  items: EditorModuleListItem[];
  canReview: boolean;
  review: boolean;
  /** Adresse de la liste filtrée, transmise aux pages du module pour le retour. */
  returnTo: string;
}

/** Version affichée : version de travail, sinon publiée, sinon la plus récente. */
const shownOf = (module: EditorModuleListItem) =>
  module.working ?? module.published ?? module.latest;

const withReturn = (href: string, returnTo: string, hash = '') =>
  `${href}?retour=${encodeURIComponent(returnTo)}${hash}`;

function primaryHref(module: EditorModuleListItem, review: boolean, returnTo: string): string {
  const toReview =
    review && module.working && ['SOUMIS', 'APPROUVE'].includes(module.working.status);
  return withReturn(
    toReview
      ? `/administration/modules/${module.id}/revision`
      : `/encadrement/modules/${module.id}/modifier`,
    returnTo,
  );
}

/** État de publication, distinct du statut éditorial de la version de travail. */
function PublicationBadge({ module }: { module: EditorModuleListItem }) {
  if (module.published) {
    return <Badge variant="success">En ligne · v{module.published.version}</Badge>;
  }
  if (module.everPublished) return <Badge variant="outline">Publication retirée</Badge>;
  return <span className="text-xs whitespace-nowrap text-muted-foreground">Jamais publié</span>;
}

/** Version de travail ; sans elle, état de la dernière version d'un module non publié. */
function WorkingCell({ module }: { module: EditorModuleListItem }) {
  const version = module.working ?? (module.published ? null : module.latest);
  if (!version) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <ModuleStatusBadge status={version.status} />
      <span className="text-xs text-muted-foreground">v{version.version}</span>
    </span>
  );
}

const authorOf = (module: EditorModuleListItem) =>
  module.createdBy ? authorName(module.createdBy) : 'Import système';

export function ModuleTable({ items, canReview, review, returnTo }: ItemsProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableCaption className="sr-only">Liste des modules</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead className="hidden xl:table-cell">Étape</TableHead>
            <TableHead className="hidden min-[1400px]:table-cell">Catégorie</TableHead>
            <TableHead>Publication</TableHead>
            <TableHead>Version de travail</TableHead>
            <TableHead className="hidden xl:table-cell">Auteur</TableHead>
            <TableHead className="hidden text-right min-[1400px]:table-cell">Leçons</TableHead>
            <TableHead>Modifié</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((module) => {
            const shown = shownOf(module);
            return (
              <TableRow key={module.id}>
                <TableCell className="max-w-72 min-w-48 whitespace-normal">
                  <Link
                    href={primaryHref(module, review, returnTo)}
                    className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    {shown.title}
                  </Link>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {module.code}
                    {module.imported && <span>· import</span>}
                  </p>
                </TableCell>
                <TableCell className="hidden xl:table-cell">{shown.stage?.name ?? '—'}</TableCell>
                <TableCell className="hidden min-[1400px]:table-cell">
                  {shown.category ? MODULE_CATEGORY_LABELS[shown.category] : 'À classer'}
                </TableCell>
                <TableCell>
                  <PublicationBadge module={module} />
                </TableCell>
                <TableCell>
                  <WorkingCell module={module} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">{authorOf(module)}</TableCell>
                <TableCell className="hidden text-right tabular-nums min-[1400px]:table-cell">
                  {shown.lessonCount}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={module.updatedAt} title={formatDateTime(module.updatedAt)}>
                    {formatDate(module.updatedAt)}
                  </time>
                </TableCell>
                <TableCell className="w-12 text-right">
                  <ModuleActions module={module} canReview={canReview} returnTo={returnTo} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ModuleCards({ items, canReview, review, returnTo }: ItemsProps) {
  return (
    <ul className="space-y-2 md:hidden" aria-label="Liste des modules">
      {items.map((module) => {
        const shown = shownOf(module);
        return (
          <li key={module.id} className="flex gap-2 rounded-xl border bg-card p-3 shadow-xs">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Link
                href={primaryHref(module, review, returnTo)}
                className="block font-medium break-words text-tesla-rouge underline-offset-4 hover:underline"
              >
                {shown.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {module.code}
                {shown.stage && ` · ${shown.stage.name}`}
                {` · ${shown.lessonCount} leçon${shown.lessonCount > 1 ? 's' : ''}`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <PublicationBadge module={module} />
                {(module.working || !module.published) && <WorkingCell module={module} />}
              </div>
              <p className="text-xs text-muted-foreground">
                Modifié le{' '}
                <time dateTime={module.updatedAt}>{formatDateTime(module.updatedAt)}</time>
              </p>
            </div>
            <ModuleActions module={module} canReview={canReview} returnTo={returnTo} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Actions permises sur un module (indication d'affichage ; l'API revérifie chaque décision).
 * Approbation, publication et archivage se font sur la page de révision, avec le contenu sous
 * les yeux ; la suppression passe par une confirmation individuelle.
 */
function ModuleActions({
  module,
  canReview,
  returnTo,
}: {
  module: EditorModuleListItem;
  canReview: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const run = useModuleAction();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = shownOf(module);
  const editHref = withReturn(`/encadrement/modules/${module.id}/modifier`, returnTo);
  const reviewHref = withReturn(`/administration/modules/${module.id}/revision`, returnTo);
  const working = module.working?.status;

  const act = async (
    action: () => Promise<{ id: string }>,
    messages: Parameters<typeof run>[1],
  ) => {
    if (busy) return;
    setBusy(true);
    let id = '';
    const ok = await run(async () => {
      const result = await action();
      id = result.id;
      return result;
    }, messages);
    setBusy(false);
    if (ok) router.push(withReturn(`/encadrement/modules/${id}/modifier`, returnTo));
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={busy}
            aria-label={`Actions pour ${shown.title}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={editHref}>
              {working === 'BROUILLON' ? <Pencil aria-hidden /> : <FileText aria-hidden />}
              {working === 'BROUILLON' ? 'Modifier' : 'Consulter'}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={withReturn(`/encadrement/modules/${module.id}/apercu`, returnTo)}>
              <Eye aria-hidden />
              Prévisualiser
            </Link>
          </DropdownMenuItem>
          {module.published && (
            <DropdownMenuItem asChild>
              <Link href={`/modules/${module.slug}`}>
                <Globe aria-hidden />
                Voir dans la bibliothèque
              </Link>
            </DropdownMenuItem>
          )}
          {canReview && (working === 'SOUMIS' || working === 'APPROUVE') && (
            <DropdownMenuItem asChild>
              <Link href={reviewHref}>
                <CheckCheck aria-hidden />
                {working === 'SOUMIS' ? 'Examiner et approuver' : 'Publier'}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link
              href={withReturn(
                `/encadrement/modules/${module.id}/modifier`,
                returnTo,
                '#historique',
              )}
            >
              <History aria-hidden />
              Historique
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void act(() => duplicateModule(module.id), {
                success: 'Module dupliqué',
                error: 'Duplication impossible',
                detail: 'La copie est un nouveau brouillon ; l’original est inchangé.',
              })
            }
          >
            <Copy aria-hidden />
            Dupliquer
          </DropdownMenuItem>
          {!module.working && (
            <DropdownMenuItem
              onSelect={() =>
                void act(
                  async () => {
                    await createModuleVersion(module.id);
                    return { id: module.id };
                  },
                  {
                    success: 'Nouvelle version créée',
                    error: 'Création impossible',
                    detail: module.published
                      ? 'La version publiée reste visible jusqu’à la publication de celle-ci.'
                      : undefined,
                  },
                )
              }
            >
              <FilePlus2 aria-hidden />
              Créer une nouvelle version
            </DropdownMenuItem>
          )}
          {canReview && module.published && (
            <DropdownMenuItem asChild>
              <Link href={reviewHref}>
                <Archive aria-hidden />
                Archiver la publication…
              </Link>
            </DropdownMenuItem>
          )}
          {module.draftDeletion && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
                <Trash2 aria-hidden />
                {module.draftDeletion === 'MODULE'
                  ? 'Supprimer le brouillon…'
                  : 'Abandonner la version de travail…'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {module.draftDeletion && (
        <DeleteDraftDialog moduleId={module.id} open={deleting} onOpenChange={setDeleting} />
      )}
    </>
  );
}
