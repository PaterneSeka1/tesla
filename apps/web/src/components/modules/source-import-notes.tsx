import { type ModuleSourceImport, SOURCE_NOTE_KIND_LABELS } from '@tesla/shared';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';

/**
 * Provenance et notes éditoriales d'un module créé par import système. Réservé aux rédacteurs et au
 * responsable : ces notes ne font pas partie du contenu publié et ne sont jamais montrées aux routiers.
 */
export function SourceImportNotes({ source }: { source: ModuleSourceImport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText aria-hidden className="size-5" />
          Module importé
        </CardTitle>
        <CardDescription>
          {source.sourceKey} · {source.sourceDocument} ({source.sourcePages}) · importé le{' '}
          {formatDateTime(source.importedAt)}. Notes invisibles des routiers.
        </CardDescription>
      </CardHeader>
      {source.editorialNotes.length > 0 && (
        <CardContent>
          <ul className="space-y-2 text-sm">
            {source.editorialNotes.map((note, index) => (
              <li key={index} className="rounded-md border bg-white p-3">
                <span className="font-medium">{SOURCE_NOTE_KIND_LABELS[note.kind]}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {note.lessonPosition === null
                    ? 'module'
                    : `leçon ${note.lessonPosition + 1} (rang à l’import)`}
                </span>
                <p className="mt-1">{note.note}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
