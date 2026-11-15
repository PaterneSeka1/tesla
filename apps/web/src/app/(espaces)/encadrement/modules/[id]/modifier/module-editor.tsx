'use client';

import { useQuery } from '@tanstack/react-query';
import { type EditorModuleDetail, MODULE_VERSION_ACTION_LABELS } from '@tesla/shared';
import {
  CircleCheck,
  Copy,
  Ellipsis,
  Eye,
  FilePlus2,
  Info,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { Disclosure } from '@/components/disclosure';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { CorrectionNotice, correctionState } from '@/components/modules/correction-notice';
import { ModuleHistory } from '@/components/modules/module-history';
import { ModuleMetadataForm } from '@/components/modules/module-metadata-form';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { SourceImportNotes } from '@/components/modules/source-import-notes';
import { useModuleAction } from '@/components/modules/use-module-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createModuleVersion,
  duplicateModule,
  editorModuleQueryOptions,
  purgeEmptyModule,
  resumeModule,
  submitModule,
  updateModuleVersion,
} from '@/lib/api/modules';
import { formatDuration } from '@/lib/format';
import { readLessonDraft } from '@/lib/lesson-drafts';
import { safeReturnPath } from '@/lib/module-list-params';
import { moduleReadiness, type ReadinessItem } from '@/lib/module-readiness';
import { cn } from '@/lib/utils';
import { CollaboratorsPanel } from './collaborators-panel';
import { LessonsPanel } from './lessons-panel';
import { ResourcesPanel } from './resources-panel';
import { TextsPanel } from './texts-panel';

/** Situation de la version en langage courant (jamais le nom technique de l'état). */
const STATE_MESSAGES: Partial<Record<EditorModuleDetail['current']['status'], string>> = {
  SOUMIS: 'Envoyé pour validation : en attente de la décision du responsable.',
  APPROUVE: 'Approuvé : en attente de publication par le responsable.',
  A_CORRIGER: 'Corrections demandées : reprenez la rédaction pour modifier cette version.',
  REFUSE: 'Refusé. Pour continuer, créez une nouvelle version.',
  PUBLIE:
    'En ligne. Pour modifier, créez une nouvelle version : celle-ci reste en ligne jusqu’à la publication de la suivante.',
  ARCHIVE: 'Archivé. Pour continuer, créez une nouvelle version.',
};

const SECTIONS = [
  { key: 'presentation', label: 'Présentation' },
  { key: 'contenu', label: 'Contenu' },
  { key: 'verification', label: 'Vérification' },
  { key: 'soumission', label: 'Soumission' },
  { key: 'historique', label: 'Historique' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

export function ModuleEditor() {
  const { id } = useParams<{ id: string }>();
  const run = useModuleAction();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { data: module, error, isPending, refetch } = useQuery(editorModuleQueryOptions(id));
  const retour = params.get('retour');
  const backHref = safeReturnPath(retour, '/encadrement/modules');
  // Ouverture de la vérification ou de la soumission : instantané des brouillons locaux.
  const [, setTick] = useState(0);

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const { current, permissions } = module;
  const requested = params.get('section') as SectionKey | null;
  const section: SectionKey = SECTIONS.some((s) => s.key === requested)
    ? requested!
    : current.lessons.length === 0 && permissions.canEdit
      ? 'presentation'
      : 'contenu';

  const go = (next: SectionKey, lessonId?: string) => {
    const query = new URLSearchParams(params.toString());
    query.set('section', next);
    if (lessonId) query.set('lecon', lessonId);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    setTick((t) => t + 1);
  };

  const lastDecision = module.events.find(
    (event) => event.versionId === current.id && event.comment && event.action !== 'SOUMISE',
  );
  const unsynced = new Set(
    current.lessons.filter((lesson) => readLessonDraft(lesson.id)).map((lesson) => lesson.id),
  );
  const readiness = moduleReadiness(current, unsynced);
  const blocking = readiness.filter((item) => item.level === 'bloquant');
  const previewHref = `/encadrement/modules/${module.id}/apercu${retour ? `?retour=${encodeURIComponent(backHref)}` : ''}`;

  const duplicate = async () => {
    let copyId = '';
    const ok = await run(
      async () => {
        const copy = await duplicateModule(module.id);
        copyId = copy.id;
        return copy;
      },
      { success: 'Module dupliqué', error: 'Duplication impossible' },
    );
    if (ok) router.push(`/encadrement/modules/${copyId}/modifier`);
  };

  const submitDialog = (trigger: React.ReactNode) => (
    <CommentDialog
      trigger={trigger}
      title="Envoyer pour validation ?"
      description={
        <p>
          Le responsable examinera la version {current.version}. Elle ne sera plus modifiable
          jusqu’à sa décision (approbation, corrections demandées ou refus).
        </p>
      }
      label="Note pour le responsable (facultative)"
      confirmLabel="Envoyer pour validation"
      onConfirm={(note) =>
        run(
          () =>
            submitModule(module.id, {
              versionId: current.id,
              revision: current.revision,
              note,
            }),
          { success: 'Module envoyé pour validation', error: 'Envoi impossible' },
        )
      }
    />
  );

  const primaryAction = permissions.canResume ? (
    <Button
      onClick={() =>
        void run(() => resumeModule(module.id, current.id), {
          success: 'Rédaction reprise',
          error: 'Reprise impossible',
        })
      }
    >
      <RotateCcw aria-hidden />
      Reprendre la rédaction
    </Button>
  ) : permissions.canCreateVersion ? (
    <Button
      onClick={() =>
        void run(() => createModuleVersion(module.id), {
          success: 'Nouvelle version créée',
          error: 'Création impossible',
          detail: module.publishedVersionId
            ? 'La version publiée reste visible jusqu’à la publication de celle-ci.'
            : undefined,
        })
      }
    >
      <FilePlus2 aria-hidden />
      Nouvelle version
    </Button>
  ) : permissions.canSubmit && section !== 'soumission' && section !== 'verification' ? (
    <Button onClick={() => go('verification')}>
      <CircleCheck aria-hidden />
      Vérifier et envoyer
    </Button>
  ) : null;

  return (
    <>
      <BackLink href={backHref}>
        {backHref.startsWith('/administration') ? 'Tous les modules' : 'Mes modules'}
      </BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {module.code} · version {current.version}
            {module.publishedVersionId &&
              module.publishedVersionId !== current.id &&
              ' · une version est en ligne'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight wrap-break-word text-tesla-bordeaux">
            {current.title}
          </h1>
          <ModuleStatusBadge status={current.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={previewHref}>
              <Eye aria-hidden />
              Aperçu
            </Link>
          </Button>
          {primaryAction}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Autres actions">
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void duplicate()}>
                <Copy aria-hidden />
                Dupliquer le module
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.canPurge && (
            <CommentDialog
              trigger={
                <Button variant="outline">
                  <Trash2 aria-hidden />
                  Supprimer ce brouillon vide
                </Button>
              }
              title="Supprimer définitivement ce brouillon ?"
              description={<p>Cette action est définitive.</p>}
              label="Motif"
              required
              destructive
              confirmLabel="Supprimer"
              onConfirm={async (comment) => {
                const ok = await run(
                  () => purgeEmptyModule(module.id, { versionId: current.id, comment }),
                  { success: 'Brouillon supprimé', error: 'Suppression impossible' },
                );
                if (ok) router.push('/administration/modules');
                return ok;
              }}
            />
          )}
        </div>
      </div>

      {correctionState(current.status, current.id, module.events) ? (
        <CorrectionNotice
          status={current.status}
          version={current.version}
          versionId={current.id}
          events={module.events}
          action={
            current.status === 'A_CORRIGER' || current.status === 'REFUSE' ? primaryAction : null
          }
        />
      ) : (
        STATE_MESSAGES[current.status] && (
          <Alert variant="info">
            <Info aria-hidden />
            <AlertTitle>{STATE_MESSAGES[current.status]}</AlertTitle>
            {lastDecision && (
              <AlertDescription>
                <p>
                  {MODULE_VERSION_ACTION_LABELS[lastDecision.action]} : « {lastDecision.comment} »
                </p>
              </AlertDescription>
            )}
          </Alert>
        )
      )}

      {module.sourceImport && <SourceImportNotes source={module.sourceImport} />}

      <div
        role="tablist"
        aria-label="Étapes de préparation du module"
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
      >
        {SECTIONS.map((item, index) => {
          const selected = item.key === section;
          const badge =
            item.key === 'verification' && permissions.canEdit && blocking.length > 0
              ? blocking.length
              : null;
          return (
            <button
              key={item.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${tabsId}-${item.key}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => go(item.key)}
              onKeyDown={(event) => {
                const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                if (!offset) return;
                event.preventDefault();
                const next = (index + offset + SECTIONS.length) % SECTIONS.length;
                go(SECTIONS[next]!.key);
                tabRefs.current[next]?.focus();
              }}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected
                  ? 'border-tesla-rouge text-tesla-bordeaux'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {index < 4 && (
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-xs',
                    selected ? 'bg-tesla-rouge text-white' : 'bg-muted',
                  )}
                >
                  {index + 1}
                </span>
              )}
              {item.label}
              {badge !== null && (
                <span className="rounded-full bg-tesla-rouge/10 px-1.5 text-xs text-tesla-rouge">
                  {badge}
                  <span className="sr-only"> point(s) à régler</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${section}`}
        className="space-y-4"
      >
        {section === 'presentation' && (
          <>
            <Card>
              <CardContent className="pt-6">
                <ModuleMetadataForm
                  version={current}
                  disabled={!permissions.canEdit}
                  submitLabel="Enregistrer la présentation"
                  onSubmit={async (values) => {
                    await run(
                      () =>
                        updateModuleVersion(module.id, {
                          versionId: current.id,
                          revision: current.revision,
                          ...values,
                        }),
                      { success: 'Présentation enregistrée', error: 'Enregistrement impossible' },
                    );
                  }}
                />
              </CardContent>
            </Card>
            <Disclosure
              title="Textes fondamentaux cités"
              summary={
                current.textLinks.length > 0
                  ? `${current.textLinks.length} texte(s) cité(s)`
                  : 'Facultatif'
              }
            >
              <TextsPanel module={module} editable={permissions.canEdit} />
            </Disclosure>
            <Disclosure
              title="Collaborateurs"
              summary={
                module.collaborators.length > 0
                  ? `${module.collaborators.length} collaborateur(s)`
                  : 'Rédiger à plusieurs'
              }
            >
              <CollaboratorsPanel module={module} />
            </Disclosure>
          </>
        )}

        {section === 'contenu' && (
          <>
            <LessonsPanel module={module} editable={permissions.canEdit} />
            <Disclosure
              title="Ressources et documents"
              summary={
                current.resources.length > 0
                  ? `${current.resources.length} ressource(s)`
                  : 'Liens, images et documents PDF joints au module'
              }
              defaultOpen={current.resources.length > 0}
            >
              <ResourcesPanel module={module} editable={permissions.canEdit} />
            </Disclosure>
          </>
        )}

        {section === 'verification' && (
          <VerificationSection
            module={module}
            readiness={readiness}
            previewHref={previewHref}
            onGo={go}
          />
        )}

        {section === 'soumission' && (
          <SubmissionSection module={module} blocking={blocking} onGo={go} submit={submitDialog} />
        )}

        {section === 'historique' && (
          <Card id="historique" className="scroll-mt-20">
            <CardContent className="pt-6">
              <ModuleHistory
                events={module.events}
                versions={module.versions}
                versionHref={(versionId) =>
                  `/encadrement/modules/${module.id}/apercu?version=${versionId}`
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function VerificationSection({
  module,
  readiness,
  previewHref,
  onGo,
}: {
  module: EditorModuleDetail;
  readiness: ReadinessItem[];
  previewHref: string;
  onGo: (section: SectionKey, lessonId?: string) => void;
}) {
  const { current, permissions } = module;
  const blocking = readiness.filter((item) => item.level === 'bloquant');
  const advice = readiness.filter((item) => item.level === 'conseil');
  const list = (items: ReadinessItem[]) => (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((item, index) => (
        <li key={index} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span>{item.message}</span>
          {permissions.canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onGo(item.section, item.lessonId)}
            >
              Corriger
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-4">
      {blocking.length === 0 ? (
        <Alert variant="info">
          <CircleCheck aria-hidden />
          <AlertTitle>Aucun point bloquant.</AlertTitle>
          <AlertDescription>
            <p>Relisez l’aperçu pour contrôler le rendu destiné aux routiers.</p>
          </AlertDescription>
        </Alert>
      ) : (
        <section className="space-y-2" aria-labelledby="verif-bloquant">
          <h2 id="verif-bloquant" className="font-semibold text-destructive">
            À régler avant l’envoi ({blocking.length})
          </h2>
          {list(blocking)}
        </section>
      )}
      {advice.length > 0 && (
        <section className="space-y-2" aria-labelledby="verif-conseil">
          <h2 id="verif-conseil" className="font-semibold">
            Conseils ({advice.length}){' '}
            <span className="font-normal text-muted-foreground">— non bloquants</span>
          </h2>
          {list(advice)}
        </section>
      )}
      <section className="space-y-2" aria-labelledby="verif-ordre">
        <h2 id="verif-ordre" className="font-semibold">
          Ordre des leçons
        </h2>
        <ol className="list-decimal space-y-1 rounded-lg border bg-card p-3 pl-8 text-sm">
          {current.lessons.map((lesson) => (
            <li key={lesson.id}>
              <button
                type="button"
                className="text-left underline-offset-4 hover:underline"
                onClick={() => onGo('contenu', lesson.id)}
              >
                {lesson.title}
              </button>
              {lesson.durationMinutes ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {formatDuration(lesson.durationMinutes)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={previewHref}>
            <Eye aria-hidden />
            Ouvrir l’aperçu
          </Link>
        </Button>
        {permissions.canSubmit && (
          <Button type="button" onClick={() => onGo('soumission')}>
            Passer à la soumission
          </Button>
        )}
      </div>
    </div>
  );
}

function SubmissionSection({
  module,
  blocking,
  onGo,
  submit,
}: {
  module: EditorModuleDetail;
  blocking: ReadinessItem[];
  onGo: (section: SectionKey) => void;
  submit: (trigger: React.ReactNode) => React.ReactNode;
}) {
  const { current, permissions } = module;
  const total = current.lessons.reduce((sum, lesson) => sum + (lesson.durationMinutes ?? 0), 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold">Récapitulatif</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Module</dt>
            <dd className="wrap-break-word">{current.title}</dd>
            <dt className="text-muted-foreground">Version</dt>
            <dd>{current.version}</dd>
            <dt className="text-muted-foreground">Étape recommandée</dt>
            <dd>{current.stage?.name ?? 'Toutes les étapes'}</dd>
            <dt className="text-muted-foreground">Leçons</dt>
            <dd>
              {current.lessons.length}
              {total > 0 && ` · ${formatDuration(total)}`}
            </dd>
            <dt className="text-muted-foreground">Ressources</dt>
            <dd>{current.resources.length}</dd>
            <dt className="text-muted-foreground">Objectifs</dt>
            <dd>
              {current.objectives.length > 0 ? current.objectives.join(' ; ') : 'Non précisés'}
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Alert variant="info">
        <Info aria-hidden />
        <AlertTitle>Ce qui se passe ensuite</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Le responsable examine le module et décide : approuver, demander des corrections ou
              refuser.
            </li>
            <li>Pendant l’examen, la version n’est plus modifiable.</li>
            <li>
              Le module n’est visible des routiers qu’après sa publication par le responsable
              {module.publishedVersionId
                ? ' ; la version actuellement en ligne le reste d’ici là'
                : ''}
              .
            </li>
          </ul>
        </AlertDescription>
      </Alert>
      {!permissions.canSubmit ? (
        <p className="text-sm text-muted-foreground">
          {STATE_MESSAGES[current.status] ??
            'Cette version ne peut pas être envoyée pour validation.'}
        </p>
      ) : blocking.length > 0 ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {blocking.length} point(s) à régler avant l’envoi.
          </p>
          <Button type="button" variant="outline" onClick={() => onGo('verification')}>
            Voir la vérification
          </Button>
        </div>
      ) : (
        submit(
          <Button>
            <Send aria-hidden />
            Envoyer pour validation
          </Button>,
        )
      )}
    </div>
  );
}
