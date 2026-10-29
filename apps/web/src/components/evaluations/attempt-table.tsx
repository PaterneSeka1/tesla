import { type CorrectionListItem, EVALUATION_MODE_LABELS } from '@tesla/shared';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatScore, fullName } from '@/lib/format';
import { AttemptStatusBadge } from './attempt-status-badge';

/** Liste de tentatives (aucun classement : ordre chronologique de traitement). */
export function AttemptTable({
  items,
  caption,
  hrefFor,
}: {
  items: CorrectionListItem[];
  caption: string;
  hrefFor: (item: CorrectionListItem) => string;
}) {
  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Routier</TableHead>
          <TableHead>Évaluation</TableHead>
          <TableHead>État</TableHead>
          <TableHead className="hidden md:table-cell">Score</TableHead>
          <TableHead className="hidden lg:table-cell">Équipe · étape</TableHead>
          <TableHead className="hidden sm:table-cell">Mise à jour</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                href={hrefFor(item)}
                className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
              >
                {fullName(item.scout)}
              </Link>
              <p className="font-mono text-xs text-muted-foreground">{item.code}</p>
            </TableCell>
            <TableCell>
              {item.evaluation.title}
              <p className="text-xs text-muted-foreground">
                v{item.version} · {EVALUATION_MODE_LABELS[item.mode]}
              </p>
            </TableCell>
            <TableCell>
              <AttemptStatusBadge status={item.status} />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {formatScore(item.score, item.maxScore)}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {item.scout.team?.name ?? '—'} · {item.scout.stage?.name ?? '—'}
            </TableCell>
            <TableCell className="hidden sm:table-cell">{formatDateTime(item.updatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
