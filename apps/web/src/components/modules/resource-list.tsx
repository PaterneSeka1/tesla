import { MODULE_RESOURCE_KIND_LABELS, type ModuleResource } from '@tesla/shared';
import { ExternalLink, FileText, Image as ImageIcon, Link2, PlayCircle } from 'lucide-react';

const ICONS = { IMAGE: ImageIcon, DOCUMENT: FileText, VIDEO: PlayCircle, LIEN: Link2 } as const;

type Resource = Pick<ModuleResource, 'id' | 'kind' | 'title' | 'url' | 'description'>;

/** Ressources externes : ouvertes dans un nouvel onglet ; l'adresse est imprimée en version papier. */
export function ResourceList({
  resources,
  actions,
}: {
  resources: Resource[];
  actions?: (resource: Resource) => React.ReactNode;
}) {
  return (
    <ul className="space-y-2">
      {resources.map((resource) => {
        const Icon = ICONS[resource.kind];
        return (
          <li key={resource.id} className="flex items-start gap-3 rounded-md border bg-white p-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
            <div className="min-w-0 flex-1">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-medium text-tesla-rouge underline-offset-4 hover:underline"
              >
                {resource.title}
                <ExternalLink className="size-3 print:hidden" aria-hidden />
                <span className="sr-only">(nouvel onglet)</span>
              </a>
              <p className="text-xs text-muted-foreground">
                {MODULE_RESOURCE_KIND_LABELS[resource.kind]}
                {resource.description && ` — ${resource.description}`}
              </p>
              <p className="hidden text-xs break-all print:block">{resource.url}</p>
            </div>
            {actions?.(resource)}
          </li>
        );
      })}
    </ul>
  );
}
