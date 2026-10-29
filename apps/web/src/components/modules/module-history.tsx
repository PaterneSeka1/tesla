import {
  MODULE_VERSION_ACTION_LABELS,
  type ModuleEvent,
  type ModuleVersionSummary,
} from '@tesla/shared';
import Link from 'next/link';
import { formatDateTime, fullName } from '@/lib/format';
import { ModuleStatusBadge } from './module-status-badge';

type HistoryVersion = Pick<ModuleVersionSummary, 'id' | 'version' | 'status'> &
  ({ lessonCount: number } | { questionCount: number });

/** Historique des versions et des décisions (modules et questionnaires ; ajout seul côté serveur). */
export function ModuleHistory({
  events,
  versions,
  versionHref,
}: {
  events: ModuleEvent[];
  versions: HistoryVersion[];
  /** Lien vers le contenu exact d'une version (aperçu). */
  versionHref?: (versionId: string) => string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section aria-labelledby="history-events" className="space-y-3">
        <h3 id="history-events" className="font-semibold">
          Décisions et étapes
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-tesla-sable pl-4">
            {events.map((event) => (
              <li key={event.id} className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{MODULE_VERSION_ACTION_LABELS[event.action]}</span>{' '}
                  <span className="text-muted-foreground">
                    · version {event.version} · {fullName(event.actor)} ·{' '}
                    {formatDateTime(event.createdAt)}
                  </span>
                </p>
                {event.comment && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
                    {event.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="history-versions" className="space-y-3">
        <h3 id="history-versions" className="font-semibold">
          Versions
        </h3>
        <ul className="space-y-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-white p-2 text-sm"
            >
              <span>
                {versionHref ? (
                  <Link
                    href={versionHref(version.id)}
                    className="text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    Version {version.version}
                  </Link>
                ) : (
                  `Version ${version.version}`
                )}
                <span className="block text-xs text-muted-foreground">
                  {'lessonCount' in version
                    ? `${version.lessonCount} leçon${version.lessonCount > 1 ? 's' : ''}`
                    : `${version.questionCount} question${version.questionCount > 1 ? 's' : ''}`}
                </span>
              </span>
              <ModuleStatusBadge status={version.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
