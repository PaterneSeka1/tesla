import { MODULE_RESOURCE_KIND_LABELS, moduleFilePath, type ModuleResource } from '@tesla/shared';
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  PlayCircle,
} from 'lucide-react';
import { env } from '@/lib/env';

const ICONS = { IMAGE: ImageIcon, DOCUMENT: FileText, VIDEO: PlayCircle, LIEN: Link2 } as const;

type Resource = Pick<ModuleResource, 'id' | 'kind' | 'title' | 'url' | 'description'> & {
  file?: ModuleResource['file'];
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;

/**
 * Ressources externes (nouvel onglet ; adresse imprimée en version papier) ou fichiers joints
 * (contenu servi après contrôle d'accès, en ligne uniquement).
 */
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
        const file = resource.file ?? null;
        return (
          <li key={resource.id} className="flex items-start gap-3 rounded-md border bg-white p-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
            <div className="min-w-0 flex-1">
              <a
                href={file ? `${env.NEXT_PUBLIC_API_URL}${moduleFilePath(file.id)}` : resource.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-medium text-tesla-rouge underline-offset-4 hover:underline"
              >
                {resource.title}
                {file ? (
                  <Download className="size-3 print:hidden" aria-hidden />
                ) : (
                  <ExternalLink className="size-3 print:hidden" aria-hidden />
                )}
                <span className="sr-only">(nouvel onglet)</span>
              </a>
              <p className="text-xs text-muted-foreground">
                {MODULE_RESOURCE_KIND_LABELS[resource.kind]}
                {file &&
                  ` — ${file.mimeType === 'application/pdf' ? 'PDF' : 'image'}, ${formatSize(file.sizeBytes)}`}
                {resource.description && ` — ${resource.description}`}
              </p>
              <p className="hidden text-xs break-all print:block">
                {file ? `Fichier joint : ${file.originalName}` : resource.url}
              </p>
            </div>
            {actions?.(resource)}
          </li>
        );
      })}
    </ul>
  );
}
